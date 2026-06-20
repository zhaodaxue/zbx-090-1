import { Router, Request, Response } from 'express';
import { TopicStage } from '@prisma/client';
import prisma from '../prisma';
import { authMiddleware, adminMiddleware, residentMiddleware } from '../middleware/auth';
import { validate, createTopicSchema, advanceStageSchema, voteSchema, createUserSchema } from '../middleware/validate';
import bcrypt from 'bcryptjs';

const router = Router();

function canAdvanceTo(from: TopicStage, to: TopicStage, topic: any): { ok: boolean; reason?: string } {
  const transitions: Record<TopicStage, TopicStage[]> = {
    PUBLIC_NOTICE: [TopicStage.DISCUSSION],
    DISCUSSION: [TopicStage.VOTING],
    VOTING: [TopicStage.ARCHIVED],
    ARCHIVED: [],
  };
  const allowed = transitions[from] || [];
  if (!allowed.includes(to)) {
    return { ok: false, reason: `无法从 ${stageLabel(from)} 跳转到 ${stageLabel(to)}` };
  }

  if (from === TopicStage.PUBLIC_NOTICE && to === TopicStage.DISCUSSION) {
    const days = (Date.now() - new Date(topic.publicNoticeAt).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 7) {
      return { ok: false, reason: `公示期不满 7 天（当前 ${days.toFixed(1)} 天），不能进入讨论期` };
    }
  }
  return { ok: true };
}

export function stageLabel(s: TopicStage): string {
  const map: Record<TopicStage, string> = {
    PUBLIC_NOTICE: '公示期',
    DISCUSSION: '讨论期',
    VOTING: '表决期',
    ARCHIVED: '归档',
  };
  return map[s];
}

router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const topics = await prisma.topic.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: { realName: true } },
      _count: { select: { votes: true, stageLogs: true } },
    },
  });
  const totalResidents = await prisma.user.count({ where: { role: 'RESIDENT' } });
  res.json({ topics, totalResidents });
});

router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const topic = await prisma.topic.findUnique({
    where: { id: req.params.id },
    include: {
      creator: { select: { realName: true } },
      stageLogs: {
        include: { operator: { select: { realName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!topic) {
    res.status(404).json({ error: '议题不存在' });
    return;
  }
  const totalResidents = await prisma.user.count({ where: { role: 'RESIDENT' } });
  const allVotes = await prisma.vote.findMany({
    where: { topicId: topic.id },
    include: { user: { select: { realName: true, roomNumber: true, username: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const stats = computeStats(allVotes, totalResidents);
  let myVote: any = null;
  if (req.user) {
    const mv = allVotes.find((v) => v.userId === req.user!.userId);
    if (mv) myVote = { choice: mv.choice, createdAt: mv.createdAt };
  }
  res.json({ topic, totalResidents, votes: allVotes, stats, myVote });
});

export function computeStats(votes: any[], totalResidents: number) {
  const participation = votes.length;
  const participationRate = totalResidents > 0 ? participation / totalResidents : 0;
  const agree = votes.filter((v) => v.choice === 'AGREE').length;
  const disagree = votes.filter((v) => v.choice === 'DISAGREE').length;
  const abstain = votes.filter((v) => v.choice === 'ABSTAIN').length;
  const effective = agree + disagree;
  const agreeRate = effective > 0 ? agree / effective : 0;
  const passed = participationRate >= 0.5 && agreeRate >= 0.667;
  return {
    participation,
    totalResidents,
    participationRate,
    agree,
    disagree,
    abstain,
    effective,
    agreeRate,
    passed,
  };
}

router.post('/', authMiddleware, adminMiddleware, validate(createTopicSchema), async (req: Request, res: Response): Promise<void> => {
  const { title, description } = req.body;
  const topic = await prisma.topic.create({
    data: {
      title,
      description,
      creatorId: req.user!.userId,
      stageLogs: {
        create: {
          toStage: TopicStage.PUBLIC_NOTICE,
          operatorId: req.user!.userId,
          remark: '议题创建，进入公示期',
        },
      },
    },
    include: { stageLogs: true },
  });
  res.status(201).json(topic);
});

router.post('/:id/advance', authMiddleware, adminMiddleware, validate(advanceStageSchema), async (req: Request, res: Response): Promise<void> => {
  const { remark } = req.body;
  const topic = await prisma.topic.findUnique({ where: { id: req.params.id } });
  if (!topic) {
    res.status(404).json({ error: '议题不存在' });
    return;
  }
  if (topic.stage === TopicStage.ARCHIVED) {
    res.status(400).json({ error: '归档的议题不可变更阶段' });
    return;
  }
  const nextStageMap: Record<TopicStage, TopicStage> = {
    PUBLIC_NOTICE: TopicStage.DISCUSSION,
    DISCUSSION: TopicStage.VOTING,
    VOTING: TopicStage.ARCHIVED,
    ARCHIVED: TopicStage.ARCHIVED,
  };
  const nextStage = nextStageMap[topic.stage];
  const check = canAdvanceTo(topic.stage, nextStage, topic);
  if (!check.ok) {
    res.status(400).json({ error: check.reason });
    return;
  }

  const votes = await prisma.vote.findMany({ where: { topicId: topic.id } });
  const totalResidents = await prisma.user.count({ where: { role: 'RESIDENT' } });

  let voteResult: any = undefined;
  let updateData: any = { stage: nextStage };
  const now = new Date();

  if (nextStage === TopicStage.DISCUSSION) {
    updateData.discussionAt = now;
  } else if (nextStage === TopicStage.VOTING) {
    updateData.votingAt = now;

    // ====== BUG④修复：观察状态在【第3次表决期开始时】即生效 ======
    // 若某住户此前已经连续 2 次未参与（consecutiveMiss >= 2），本次表决期直接进入观察状态，禁止参与本次投票
    const preObsResidents = await prisma.user.findMany({
      where: { role: 'RESIDENT', status: 'NORMAL', consecutiveMiss: { gte: 2 } },
    });
    for (const r of preObsResidents) {
      await prisma.user.update({
        where: { id: r.id },
        data: { status: 'OBSERVATION' },
      });
    }
  } else if (nextStage === TopicStage.ARCHIVED) {
    updateData.archivedAt = now;
    const { passed } = computeStats(votes, totalResidents);
    voteResult = passed ? 'PASSED' : 'REJECTED';
    updateData.voteResult = voteResult;

    // 归档只更新 consecutiveMiss 计数，不自动修改 status
    // 观察状态必须经物业人工解除；下一次进入表决期时会根据计数再触发
    const voterIds = new Set(votes.map((v) => v.userId));
    const allResidents = await prisma.user.findMany({ where: { role: 'RESIDENT' } });
    for (const r of allResidents) {
      const didVote = voterIds.has(r.id);
      const newMiss = didVote ? 0 : r.consecutiveMiss + 1;
      // status 保持不变（OBSERVATION 不自动解除，也不在此处从 NORMAL 升级到 OBSERVATION）
      // 仅当本次参与了投票且原本为 NORMAL 时才清零是正常行为；
      // 观察状态用户的计数仍然累计/清零，方便解除后计算基准，但 status 不受影响
      await prisma.user.update({
        where: { id: r.id },
        data: { consecutiveMiss: newMiss },
      });
    }
  }

  const updated = await prisma.topic.update({
    where: { id: topic.id },
    data: {
      ...updateData,
      stageLogs: {
        create: {
          fromStage: topic.stage,
          toStage: nextStage,
          operatorId: req.user!.userId,
          remark: remark || `由 ${stageLabel(topic.stage)} 推进至 ${stageLabel(nextStage)}`,
        },
      },
    },
    include: { stageLogs: true },
  });
  res.json({ topic: updated, voteResult });
});

router.post('/:id/vote', authMiddleware, residentMiddleware, validate(voteSchema), async (req: Request, res: Response): Promise<void> => {
  const { choice } = req.body;
  const topic = await prisma.topic.findUnique({ where: { id: req.params.id } });
  if (!topic) {
    res.status(404).json({ error: '议题不存在' });
    return;
  }
  if (topic.stage !== TopicStage.VOTING) {
    res.status(400).json({ error: `当前处于${stageLabel(topic.stage)}，仅表决期可投票` });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  if (user.status === 'OBSERVATION') {
    res.status(400).json({ error: '您的账号处于观察状态，无法投票，请联系物业解除' });
    return;
  }
  const existing = await prisma.vote.findUnique({
    where: { userId_topicId: { userId: user.id, topicId: topic.id } },
  });
  if (existing) {
    res.status(400).json({ error: '您已对该议题投票，不可重复投票' });
    return;
  }
  const vote = await prisma.vote.create({
    data: { userId: user.id, topicId: topic.id, choice },
  });
  res.status(201).json(vote);
});

router.get('/:id/export/csv', authMiddleware, adminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const topic = await prisma.topic.findUnique({ where: { id: req.params.id } });
  if (!topic) {
    res.status(404).json({ error: '议题不存在' });
    return;
  }
  if (topic.stage !== TopicStage.ARCHIVED) {
    res.status(400).json({ error: '仅归档议题可导出' });
    return;
  }
  const votes = await prisma.vote.findMany({
    where: { topicId: topic.id },
    include: { user: { select: { realName: true, roomNumber: true, username: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const totalResidents = await prisma.user.count({ where: { role: 'RESIDENT' } });
  const stats = computeStats(votes, totalResidents);
  const logs = await prisma.stageLog.findMany({
    where: { topicId: topic.id },
    include: { operator: { select: { realName: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const lines: string[] = [];
  lines.push('议事厅 - 议题归档摘要');
  lines.push('');
  lines.push(`议题编号,${topic.id}`);
  lines.push(`标题,${topic.title}`);
  lines.push(`描述,"${topic.description.replace(/"/g, '""')}"`);
  lines.push(`创建时间,${topic.createdAt.toISOString()}`);
  lines.push(`最终阶段,${stageLabel(topic.stage)}`);
  lines.push(`表决结果,${topic.voteResult === 'PASSED' ? '通过' : topic.voteResult === 'REJECTED' ? '未通过' : '待定'}`);
  lines.push('');
  lines.push('=== 计票统计 ===');
  lines.push(`登记住户总数,${stats.totalResidents}`);
  lines.push(`参与投票人数,${stats.participation}`);
  lines.push(`参与率,${(stats.participationRate * 100).toFixed(2)}%`);
  lines.push(`同意票,${stats.agree}`);
  lines.push(`反对票,${stats.disagree}`);
  lines.push(`弃权票,${stats.abstain}`);
  lines.push(`有效票(同意+反对),${stats.effective}`);
  lines.push(`同意票占有效票比例,${(stats.agreeRate * 100).toFixed(2)}%`);
  lines.push(`通过条件,参与率>=50% 且 同意率>=66.7%`);
  lines.push('');
  lines.push('=== 阶段变更日志 ===');
  lines.push('序号,原阶段,新阶段,操作人,时间,备注');
  logs.forEach((l, i) => {
    lines.push([
      i + 1,
      l.fromStage ? stageLabel(l.fromStage) : '-',
      stageLabel(l.toStage),
      l.operator.realName,
      l.createdAt.toISOString(),
      `"${(l.remark || '').replace(/"/g, '""')}"`,
    ].join(','));
  });
  lines.push('');
  lines.push('=== 投票明细 ===');
  lines.push('序号,用户名,真实姓名,房号,选择,时间');
  const choiceMap: Record<string, string> = { AGREE: '同意', DISAGREE: '反对', ABSTAIN: '弃权' };
  votes.forEach((v, i) => {
    lines.push([
      i + 1,
      v.user.username,
      v.user.realName,
      v.user.roomNumber,
      choiceMap[v.choice],
      v.createdAt.toISOString(),
    ].join(','));
  });

  const filename = `topic-${topic.id.slice(0, 8)}-archive.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8-sig');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\ufeff' + lines.join('\n'));
});

export default router;
