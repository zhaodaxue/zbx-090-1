import { useState, useEffect } from 'react';
import { api } from '../api';
import {
  UserInfo, TopicDetail, VoteRecord, VoteStats, StageLog,
  STAGE_LABEL, CHOICE_LABEL, RESULT_LABEL, TopicStage, VoteChoice, VoteResult
} from '../types';

interface Props {
  topicId: string;
  user: UserInfo;
  from: 'resident' | 'admin';
  onBack: () => void;
  onChange: () => void;
}

// 投票预览：投出一票后，同意率是多少（严格遵循服务端口径）
// 弃权：有效票不变 → 同意率不变；同意或反对：有效票 +1，对应分子 +1
function computePreviewAgreeRate(choice: VoteChoice, stats: VoteStats): number {
  if (choice === 'ABSTAIN') {
    // 弃权：有效票数量不变（弃权不计入），同意数也不变
    if (stats.effective === 0) return -1;
    return stats.agree / stats.effective;
  }
  const newAgree = stats.agree + (choice === 'AGREE' ? 1 : 0);
  const newEffective = stats.effective + 1; // 同意或反对都计入有效票
  if (newEffective === 0) return -1;
  return newAgree / newEffective;
}

// 投票预览：投出一票后，是否同时满足双阈值
function computePreviewPassed(choice: VoteChoice, stats: VoteStats): boolean {
  const newParticipation = stats.participation + 1; // 无论如何都算参与
  const participationRate = newParticipation / stats.totalResidents;
  const agreeRate = computePreviewAgreeRate(choice, stats);
  return participationRate >= 0.5 && agreeRate >= 0.667;
}

export default function TopicDetailPage({ topicId, user, from, onBack, onChange }: Props) {
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [stats, setStats] = useState<VoteStats | null>(null);
  const [stageLogs, setStageLogs] = useState<StageLog[]>([]);
  const [totalResidents, setTotalResidents] = useState(0);
  const [myVote, setMyVote] = useState<{ choice: VoteChoice; createdAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChoice, setSelectedChoice] = useState<VoteChoice | null>(null);
  const [voting, setVoting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [remark, setRemark] = useState('');
  const [showAdvance, setShowAdvance] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.getTopic(topicId);
      setTopic(d.topic);
      setVotes(d.votes);
      setStats(d.stats);
      setStageLogs(d.topic.stageLogs);
      setTotalResidents(d.totalResidents);
      setMyVote(d.myVote);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || '加载失败' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [topicId]);

  const stageIndex = (s: TopicStage) => ['PUBLIC_NOTICE', 'DISCUSSION', 'VOTING', 'ARCHIVED'].indexOf(s);

  const doVote = async () => {
    if (!selectedChoice) return;
    setVoting(true); setMsg(null);
    try {
      await api.vote(topicId, selectedChoice);
      setMsg({ type: 'success', text: '投票成功！' });
      setMyVote({ choice: selectedChoice, createdAt: new Date().toISOString() });
      await load();
      onChange();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || '投票失败' });
    } finally {
      setVoting(false);
    }
  };

  const doAdvance = async () => {
    setAdvancing(true); setMsg(null);
    try {
      const r = await api.advanceStage(topicId, remark.trim() || undefined);
      setMsg({ type: 'success', text: `阶段推进成功！${r.voteResult ? `表决结果：${RESULT_LABEL[r.voteResult as VoteResult]}` : ''}` });
      setShowAdvance(false); setRemark('');
      await load();
      onChange();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || '推进失败' });
    } finally {
      setAdvancing(false);
    }
  };

  const doExport = async () => {
    try {
      const resp = await api.exportTopicCsv(topicId);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disp = resp.headers.get('content-disposition') || '';
      const m = disp.match(/filename="?([^"]+)"?/);
      a.href = url;
      a.download = m ? m[1] : `topic-${topicId}.csv`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || '导出失败' });
    }
  };

  if (loading) return <div className="container"><div className="card">加载中...</div></div>;
  if (!topic || !stats) return <div className="container"><div className="card">加载失败</div></div>;

  const currentStageIdx = stageIndex(topic.stage);
  const canVote = user.role === 'RESIDENT' && topic.stage === 'VOTING' && !myVote && user.status !== 'OBSERVATION';
  const canAdvance = user.role === 'ADMIN' && topic.stage !== 'ARCHIVED';
  const nextStage = (() => {
    const map: Record<TopicStage, TopicStage> = { PUBLIC_NOTICE: 'DISCUSSION', DISCUSSION: 'VOTING', VOTING: 'ARCHIVED', ARCHIVED: 'ARCHIVED' };
    return map[topic.stage];
  })();

  return (
    <div className="container">
      <div className="breadcrumb">
        <a onClick={onBack}>← 返回{from === 'admin' ? '管理控制台' : '首页'}</a>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <h2 style={{ border: 'none', padding: 0, margin: 0, fontSize: 20 }}>
              {topic.title}
              <span style={{ marginLeft: 12 }}>
                <span className={`badge ${topic.stage === 'PUBLIC_NOTICE' ? 'badge-blue' : topic.stage === 'DISCUSSION' ? 'badge-green' : topic.stage === 'VOTING' ? 'badge-orange' : 'badge-gray'}`}>
                  {STAGE_LABEL[topic.stage]}
                </span>
                {topic.stage === 'ARCHIVED' && (
                  <span className={`badge ${topic.voteResult === 'PASSED' ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: 8 }}>
                    {RESULT_LABEL[topic.voteResult]}
                  </span>
                )}
              </span>
            </h2>
            <div style={{ marginTop: 8, fontSize: 13, color: '#8c8c8c' }}>
              创建人：{topic.creator.realName} · 创建时间：{new Date(topic.createdAt).toLocaleString()}
            </div>
          </div>
          {user.role === 'ADMIN' && (
            <div>
              {canAdvance && <button className="btn btn-success" onClick={() => setShowAdvance(!showAdvance)}>
                推进阶段 → {STAGE_LABEL[nextStage]}
              </button>}
              {topic.stage === 'ARCHIVED' && <button className="btn" onClick={doExport}>📥 导出归档 CSV</button>}
            </div>
          )}
        </div>

        {showAdvance && canAdvance && (
          <div className="card" style={{ marginTop: 16, background: '#fafafa', border: '1px dashed #d9d9d9' }}>
            <h3>推进到「{STAGE_LABEL[nextStage]}」</h3>
            <div className="form-group">
              <label>阶段变更备注（可选）</label>
              <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="如：公示无异议，进入讨论期" />
            </div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 12 }}>
              ⚠️ 阶段推进后不可撤销，系统会自动校验前置条件
            </div>
            <div>
              <button className="btn btn-success" onClick={doAdvance} disabled={advancing}>
                {advancing ? '处理中...' : '确认推进'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAdvance(false)}>取消</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <h3>议题内容</h3>
          <div className="description-box">{topic.description}</div>
        </div>
      </div>

      <div className="card">
        <h2>阶段流转</h2>
        <div className="stage-timeline">
          {(['PUBLIC_NOTICE', 'DISCUSSION', 'VOTING', 'ARCHIVED'] as TopicStage[]).map((s, i) => (
            <div key={s} className={`stage-step ${i < currentStageIdx ? 'done' : i === currentStageIdx ? 'active' : ''}`}>
              <div className="dot">{i + 1}</div>
              <div className="label">{STAGE_LABEL[s]}</div>
            </div>
          ))}
        </div>

        <h3>阶段变更日志</h3>
        <table>
          <thead><tr><th>时间</th><th>从阶段</th><th>到阶段</th><th>操作人</th><th>备注</th></tr></thead>
          <tbody>
            {stageLogs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td>{l.fromStage ? STAGE_LABEL[l.fromStage] : '-'}</td>
                <td><b>{STAGE_LABEL[l.toStage]}</b></td>
                <td>{l.operator.realName}</td>
                <td>{l.remark || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>计票统计</h2>
        <div className="stats-grid">
          <div className="stat-box"><div className="num">{stats.totalResidents}</div><div className="lbl">登记住户总数</div></div>
          <div className={`stat-box ${stats.participationRate >= 0.5 ? 'passed' : ''}`}>
            <div className="num">{stats.participation}</div>
            <div className="lbl">已参与 ({(stats.participationRate * 100).toFixed(1)}%，需 ≥50%)</div>
          </div>
          <div className="stat-box agree"><div className="num">{stats.agree}</div><div className="lbl">同意票</div></div>
          <div className="stat-box disagree"><div className="num">{stats.disagree}</div><div className="lbl">反对票</div></div>
          <div className="stat-box abstain"><div className="num">{stats.abstain}</div><div className="lbl">弃权票</div></div>
          <div className={`stat-box ${stats.passed ? 'passed' : topic.stage === 'ARCHIVED' ? 'rejected' : ''}`}>
            <div className="num">{(stats.agreeRate * 100).toFixed(1)}%</div>
            <div className="lbl">同意占有效票（有效票 {stats.effective}，需 ≥66.7%）</div>
          </div>
        </div>

        <div className="progress-bar">
          <div className="agree-part" style={{ width: stats.participation > 0 ? `${(stats.agree / stats.participation) * 100}%` : 0 }}></div>
          <div className="disagree-part" style={{ width: stats.participation > 0 ? `${(stats.disagree / stats.participation) * 100}%` : 0 }}></div>
          <div className="abstain-part" style={{ width: stats.participation > 0 ? `${(stats.abstain / stats.participation) * 100}%` : 0 }}></div>
        </div>
        <div className="progress-label">
          <span>同意 {stats.agree}</span>
          <span>反对 {stats.disagree}</span>
          <span>弃权 {stats.abstain}</span>
        </div>

        {topic.stage === 'ARCHIVED' && (
          <div className={`alert ${topic.voteResult === 'PASSED' ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 16 }}>
            <b>表决结果：{RESULT_LABEL[topic.voteResult]}</b>
            <div style={{ marginTop: 4, fontSize: 13 }}>
              参与率 {(stats.participationRate * 100).toFixed(1)}%（≥50%：{stats.participationRate >= 0.5 ? '✅ 达标' : '❌ 未达标'}），
              同意率 {(stats.agreeRate * 100).toFixed(1)}%（≥66.7%：{stats.agreeRate >= 0.667 ? '✅ 达标' : '❌ 未达标'}）
            </div>
          </div>
        )}
      </div>

      {canVote && (
        <div className="card">
          <h2>📝 请投出您的一票</h2>
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            每位住户对每个议题仅能投一次票，投票后不可更改。点击选项可预览投票影响。
          </div>
          <div className="vote-options">
            <div
              className={`vote-opt agree ${selectedChoice === 'AGREE' ? 'active' : ''}`}
              onClick={() => setSelectedChoice('AGREE')}
            >
              👍 同意
            </div>
            <div
              className={`vote-opt disagree ${selectedChoice === 'DISAGREE' ? 'active' : ''}`}
              onClick={() => setSelectedChoice('DISAGREE')}
            >
              👎 反对
            </div>
            <div
              className={`vote-opt abstain ${selectedChoice === 'ABSTAIN' ? 'active' : ''}`}
              onClick={() => setSelectedChoice('ABSTAIN')}
            >
              🤷 弃权
            </div>
          </div>

          {/* 投票效果预览 */}
          {selectedChoice && stats && (
            <div className="vote-preview">
              <div className="vote-preview-title">
                🔍 若您投 <b>{CHOICE_LABEL[selectedChoice]}</b> 票，预计结果变化：
              </div>
              <div className="stats-grid" style={{ marginTop: 12 }}>
                <div className="stat-box">
                  <div className="num">
                    {stats.participation + 1}
                    <span className="delta-up">+1</span>
                  </div>
                  <div className="lbl">
                    参与率：{(((stats.participation + 1) / stats.totalResidents) * 100).toFixed(1)}%
                    <br />
                    <span className={((stats.participation + 1) / stats.totalResidents) >= 0.5 ? 'text-pass' : 'text-fail'}>
                      {((stats.participation + 1) / stats.totalResidents) >= 0.5 ? '✅ 达参与率阈值' : '❌ 未达参与率阈值 (≥50%)'}
                    </span>
                  </div>
                </div>
                <div className="stat-box agree">
                  <div className="num">
                    {stats.agree + (selectedChoice === 'AGREE' ? 1 : 0)}
                    <span className={selectedChoice === 'AGREE' ? 'delta-up' : 'delta-flat'}>
                      {selectedChoice === 'AGREE' ? '+1' : '+0'}
                    </span>
                  </div>
                  <div className="lbl">同意票（含您的选择）</div>
                </div>
                <div className="stat-box disagree">
                  <div className="num">
                    {stats.disagree + (selectedChoice === 'DISAGREE' ? 1 : 0)}
                    <span className={selectedChoice === 'DISAGREE' ? 'delta-up' : 'delta-flat'}>
                      {selectedChoice === 'DISAGREE' ? '+1' : '+0'}
                    </span>
                  </div>
                  <div className="lbl">反对票</div>
                </div>
                <div className="stat-box abstain">
                  <div className="num">
                    {stats.abstain + (selectedChoice === 'ABSTAIN' ? 1 : 0)}
                    <span className={selectedChoice === 'ABSTAIN' ? 'delta-up' : 'delta-flat'}>
                      {selectedChoice === 'ABSTAIN' ? '+1' : '+0'}
                    </span>
                  </div>
                  <div className="lbl">弃权票（不计入有效票）</div>
                </div>
                <div className="stat-box">
                  <div className="num">
                    {stats.effective + (selectedChoice === 'AGREE' || selectedChoice === 'DISAGREE' ? 1 : 0)}
                    <span className={selectedChoice === 'AGREE' || selectedChoice === 'DISAGREE' ? 'delta-up' : 'delta-flat'}>
                      {selectedChoice === 'AGREE' || selectedChoice === 'DISAGREE' ? '+1' : '+0'}
                    </span>
                  </div>
                  <div className="lbl">有效票（同意+反对）</div>
                </div>
                <div className={`stat-box ${computePreviewPassed(selectedChoice, stats) ? 'passed' : ''}`}>
                  <div className="num">
                    {computePreviewAgreeRate(selectedChoice, stats) >= 0
                      ? `${(computePreviewAgreeRate(selectedChoice, stats) * 100).toFixed(1)}%`
                      : '—'}
                  </div>
                  <div className="lbl">
                    同意占有效票比例
                    <br />
                    <span className={computePreviewPassed(selectedChoice, stats) ? 'text-pass' : 'text-fail'}>
                      {computePreviewPassed(selectedChoice, stats)
                        ? '✅ 双阈值均达标（通过）'
                        : '❌ 未同时满足双阈值'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 8 }}>
                * 计算口径与实际表决一致：弃权票计入参与率分母，但不计入有效票的分子与分母。
              </div>
            </div>
          )}

          <button
            className="btn btn-success"
            onClick={doVote}
            disabled={!selectedChoice || voting}
            style={{ marginTop: selectedChoice ? 16 : 0 }}
          >
            {voting ? '提交中...' : '确认提交'}
          </button>
        </div>
      )}

      {myVote && (
        <div className="card">
          <h2>我的投票</h2>
          <div className="alert alert-success">
            ✅ 您已在 {new Date(myVote.createdAt).toLocaleString()} 投出：
            <span className={`badge ${myVote.choice === 'AGREE' ? 'badge-green' : myVote.choice === 'DISAGREE' ? 'badge-red' : 'badge-gray'}`} style={{ marginLeft: 8 }}>
              {CHOICE_LABEL[myVote.choice]}
            </span>
          </div>
        </div>
      )}

      {user.role === 'RESIDENT' && topic.stage === 'VOTING' && !myVote && user.status === 'OBSERVATION' && (
        <div className="card">
          <div className="alert alert-warning">
            ⚠️ 您的账号处于观察状态，无法投票，请联系物业人工解除。
          </div>
        </div>
      )}

      {(topic.stage === 'ARCHIVED' || user.role === 'ADMIN') && votes.length > 0 && (
        <div className="card">
          <h2>投票明细（{votes.length}）</h2>
          <table>
            <thead><tr><th>#</th><th>用户名</th><th>姓名</th><th>房号</th><th>选择</th><th>时间</th></tr></thead>
            <tbody>
              {votes.map((v, i) => (
                <tr key={v.id}>
                  <td>{i + 1}</td>
                  <td>{v.user.username}</td>
                  <td>{v.user.realName}</td>
                  <td>{v.user.roomNumber}</td>
                  <td>
                    <span className={`badge ${v.choice === 'AGREE' ? 'badge-green' : v.choice === 'DISAGREE' ? 'badge-red' : 'badge-gray'}`}>
                      {CHOICE_LABEL[v.choice]}
                    </span>
                  </td>
                  <td>{new Date(v.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
