import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import {
  TopicListItem, STAGE_LABEL, RESULT_LABEL,
  UserInfo, VoteRecord, VoteResult
} from '../types';

interface Props {
  user: UserInfo;
  onOpenTopic: (id: string) => void;
}

type Tab = 'todo' | 'current' | 'archive' | 'my';

// 轮询间隔（毫秒）—— 管理员推进阶段后，最多这么久能在住户端看到
const POLL_INTERVAL_MS = 15000;

export default function ResidentHome({ user, onOpenTopic }: Props) {
  const [tab, setTab] = useState<Tab>('todo');
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [myVotes, setMyVotes] = useState<VoteRecord[]>([]);
  const [missedTopics, setMissedTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalResidents, setTotalResidents] = useState(0);
  const pollTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [tResp, mResp] = await Promise.all([api.listTopics(), api.myRecords()]);
      setTopics(tResp.topics);
      setTotalResidents(tResp.totalResidents);
      setMyVotes(mResp.votes);
      setMissedTopics(mResp.missed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初次加载
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 页面可见时立即刷新 + 启动轮询
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // 定时轮询（不阻塞 UI）
    pollTimerRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (pollTimerRef.current != null) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, [load]);

  // 计算待办议题：表决期内 + 我未投过 + 我非观察状态
  const votedTopicIds = new Set(myVotes.map((v) => v.topicId));
  const todoTopics =
    user.status === 'OBSERVATION'
      ? []
      : topics.filter((t) => t.stage === 'VOTING' && !votedTopicIds.has(t.id));

  const currentTopics = topics.filter((t) => t.stage !== 'ARCHIVED');
  const archivedTopics = topics.filter((t) => t.stage === 'ARCHIVED');

  const stageBadgeClass = (s: string) =>
    s === 'PUBLIC_NOTICE' ? 'badge-blue'
    : s === 'DISCUSSION' ? 'badge-green'
    : s === 'VOTING' ? 'badge-orange'
    : 'badge-gray';

  // 风险级别文案
  const riskAlert = (() => {
    if (user.status === 'OBSERVATION') {
      return {
        level: 'error',
        title: '⚠️ 账号处于观察状态',
        desc: `您已连续 ${user.consecutiveMiss ?? 0} 次未参与表决，目前无法投票。请联系物业人工解除观察状态。`,
      };
    }
    const miss = user.consecutiveMiss ?? 0;
    if (miss >= 2) {
      return {
        level: 'error',
        title: '🔥 高风险：再缺席 1 次将进入观察状态',
        desc: `您已连续 ${miss} 次未参与表决。根据规则，第 3 次表决期开始时您的账号将自动进入观察状态，届时将无法投票，需物业人工解除。`,
      };
    }
    if (miss === 1) {
      return {
        level: 'warning',
        title: '⚡ 请注意：已缺席 1 次',
        desc: '若再连续缺席 2 次表决，将触发观察状态，无法投票。请及时参与当前待办议题。',
      };
    }
    return null;
  })();

  const scrollToTodo = () => setTab('todo');

  return (
    <div className="container">
      {/* 顶部汇总条：待办数量 + 风险提示 */}
      <div
        className={`card todo-summary ${
          user.status === 'OBSERVATION'
            ? 'todo-summary-observation'
            : todoTopics.length > 0
            ? 'todo-summary-active'
            : 'todo-summary-clear'
        }`}
        style={{
          padding: '14px 20px',
          marginBottom: 16,
          borderRadius: 8,
          cursor: user.status !== 'OBSERVATION' && todoTopics.length > 0 ? 'pointer' : 'default',
          transition: 'all 0.2s',
          background:
            user.status === 'OBSERVATION'
              ? '#fff2f0'
              : todoTopics.length > 0
              ? 'linear-gradient(135deg, #fff7e6, #ffe7ba)'
              : '#f6ffed',
          border:
            user.status === 'OBSERVATION'
              ? '1px solid #ffccc7'
              : todoTopics.length > 0
              ? '1px solid #ffd591'
              : '1px solid #b7eb8f',
        }}
        onClick={() => user.status !== 'OBSERVATION' && todoTopics.length > 0 && scrollToTodo()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28 }}>
              {user.status === 'OBSERVATION' ? '🚫' : todoTopics.length > 0 ? '📋' : '✅'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#262626' }}>
                {user.status === 'OBSERVATION'
                  ? '观察状态中，暂无待办'
                  : todoTopics.length > 0
                  ? `您有 ${todoTopics.length} 个待表决的议题`
                  : '暂无待表决的议题'}
              </div>
              <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>
                {user.status === 'OBSERVATION'
                  ? '请联系物业人工解除观察状态后即可参与表决'
                  : todoTopics.length > 0
                  ? '点击此处快速跳转到待办列表，或在下方「待办」Tab 查看'
                  : '所有进行中的议题您都已参与，继续保持 👍'}
              </div>
            </div>
          </div>
          {user.status !== 'OBSERVATION' && todoTopics.length > 0 && (
            <span
              className="badge badge-orange"
              style={{ fontSize: 14, padding: '4px 14px' }}
            >
              立即投票 →
            </span>
          )}
        </div>
      </div>

      {/* 风险提示（仅正常状态且有未参与计数时显示） */}
      {riskAlert && (
        <div className={`alert alert-${riskAlert.level}`}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{riskAlert.title}</div>
          <div style={{ fontSize: 13 }}>{riskAlert.desc}</div>
        </div>
      )}

      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: '#8c8c8c' }}>住户信息</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginTop: 2 }}>
              {user.realName} · {user.roomNumber}
              {user.consecutiveMiss != null && user.consecutiveMiss > 0 && (
                <span
                  className={`badge ${
                    user.status === 'OBSERVATION' ? 'badge-red' : user.consecutiveMiss >= 2 ? 'badge-orange' : 'badge-blue'
                  }`}
                  style={{ marginLeft: 8 }}
                >
                  连续未参与 {user.consecutiveMiss} 次
                </span>
              )}
              {user.status === 'OBSERVATION' && (
                <span className="badge badge-red" style={{ marginLeft: 8 }}>观察状态</span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#8c8c8c' }}>
            小区登记住户共 <b style={{ color: '#1890ff' }}>{totalResidents}</b> 户
          </div>
        </div>
      </div>

      <div className="tabs">
        <div
          className={`tab ${tab === 'todo' ? 'active' : ''}`}
          onClick={() => setTab('todo')}
        >
          待办 ({user.status === 'OBSERVATION' ? 0 : todoTopics.length})
        </div>
        <div className={`tab ${tab === 'current' ? 'active' : ''}`} onClick={() => setTab('current')}>
          进行中 ({currentTopics.length})
        </div>
        <div className={`tab ${tab === 'archive' ? 'active' : ''}`} onClick={() => setTab('archive')}>
          历史归档 ({archivedTopics.length})
        </div>
        <div className={`tab ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>
          我的参与记录
        </div>
      </div>

      {loading && <div className="card">加载中...</div>}

      {/* 待办 Tab */}
      {!loading && tab === 'todo' && (
        <div>
          {user.status === 'OBSERVATION' ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <h3 style={{ marginBottom: 8, color: '#cf1322' }}>观察状态，暂无可投票议题</h3>
              <div style={{ color: '#8c8c8c', fontSize: 14, lineHeight: 1.8 }}>
                您的账号因连续多次未参与表决，已进入观察状态。<br />
                在此状态下您仍可浏览议题内容与历史记录，但无法参与投票。<br />
                如需解除观察状态，请联系物业/业委会工作人员人工处理。
              </div>
              <div style={{ marginTop: 20 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setTab('current')}
                >
                  浏览进行中的议题
                </button>
              </div>
            </div>
          ) : todoTopics.length === 0 ? (
            <div className="card empty">
              <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
              暂无待表决的议题
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 6 }}>
                所有进行中的议题您都已参与，或暂无处于表决期的议题
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 12, fontSize: 13, color: '#595959' }}>
                以下议题处于表决期且您尚未投票，请及时行使您的表决权
              </div>
              {todoTopics.map((t) => (
                <div
                  key={t.id}
                  className="topic-list-item"
                  style={{
                    borderColor: '#ffa940',
                    boxShadow: '0 2px 8px rgba(255, 169, 64, 0.15)',
                  }}
                  onClick={() => onOpenTopic(t.id)}
                >
                  <h3>
                    <span>{t.title}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="badge badge-orange">待投票</span>
                    </span>
                  </h3>
                  <div className="desc">{t.description}</div>
                  <div className="topic-meta">
                    <span>创建人：{t.creator.realName}</span>
                    <span>已有 {t._count.votes} 人参与</span>
                    <span style={{ color: '#d46b08', fontWeight: 500 }}>
                      去投票 →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'current' && (
        <div>
          {currentTopics.length === 0 && <div className="card empty">暂无进行中的议题</div>}
          {currentTopics.map((t) => (
            <div key={t.id} className="topic-list-item" onClick={() => onOpenTopic(t.id)}>
              <h3>
                <span>{t.title}</span>
                <span className={`badge ${stageBadgeClass(t.stage)}`}>
                  {STAGE_LABEL[t.stage as TopicStage]}
                </span>
              </h3>
              <div className="desc">{t.description}</div>
              <div className="topic-meta">
                <span>创建人：{t.creator.realName}</span>
                <span>创建时间：{new Date(t.createdAt).toLocaleString()}</span>
                <span>已有 {t._count.votes} 人参与</span>
                {t.stage === 'VOTING' && !votedTopicIds.has(t.id) && user.status !== 'OBSERVATION' && (
                  <span style={{ color: '#d46b08', fontWeight: 500 }}>待投票 →</span>
                )}
                {t.stage === 'VOTING' && votedTopicIds.has(t.id) && (
                  <span style={{ color: '#389e0d', fontWeight: 500 }}>✓ 已投票</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'archive' && (
        <div>
          {archivedTopics.length === 0 && <div className="card empty">暂无归档议题</div>}
          {archivedTopics.map((t) => (
            <div key={t.id} className="topic-list-item" onClick={() => onOpenTopic(t.id)}>
              <h3>
                <span>{t.title}</span>
                <span style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-gray">{STAGE_LABEL.ARCHIVED}</span>
                  <span className={`badge ${t.voteResult === 'PASSED' ? 'badge-green' : 'badge-red'}`}>
                    {RESULT_LABEL[t.voteResult as VoteResult]}
                  </span>
                </span>
              </h3>
              <div className="desc">{t.description}</div>
              <div className="topic-meta">
                <span>创建人：{t.creator.realName}</span>
                <span>创建时间：{new Date(t.createdAt).toLocaleString()}</span>
                <span>共 {t._count.votes} 人参与</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'my' && (
        <div>
          <div className="card">
            <h2>已参与表决（{myVotes.length}）</h2>
            {myVotes.length === 0 && <div className="empty">尚未参与任何表决</div>}
            {myVotes.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>议题</th>
                    <th>我的选择</th>
                    <th>表决结果</th>
                    <th>投票时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {myVotes.map((v) => {
                    const t = (v as any).topic;
                    return (
                      <tr key={v.id}>
                        <td style={{ maxWidth: 280 }}>{t.title}</td>
                        <td>
                          <span className={`badge ${v.choice === 'AGREE' ? 'badge-green' : v.choice === 'DISAGREE' ? 'badge-red' : 'badge-gray'}`}>
                            {v.choice === 'AGREE' ? '同意' : v.choice === 'DISAGREE' ? '反对' : '弃权'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${t.voteResult === 'PASSED' ? 'badge-green' : 'badge-red'}`}>
                            {RESULT_LABEL[t.voteResult as VoteResult]}
                          </span>
                        </td>
                        <td>{new Date(v.createdAt).toLocaleString()}</td>
                        <td><a onClick={() => onOpenTopic(t.id)}>查看</a></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>未参与的归档表决（{missedTopics.length}）</h2>
            {missedTopics.length === 0 && <div className="empty">所有归档表决均已参与 👍</div>}
            {missedTopics.length > 0 && (
              <table>
                <thead>
                  <tr><th>议题</th><th>表决结果</th><th>创建时间</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {missedTopics.map((t: any) => (
                    <tr key={t.id}>
                      <td style={{ maxWidth: 280 }}>{t.title}</td>
                      <td>
                        <span className={`badge ${t.voteResult === 'PASSED' ? 'badge-green' : 'badge-red'}`}>
                          {RESULT_LABEL[t.voteResult as VoteResult]}
                        </span>
                      </td>
                      <td>{new Date(t.createdAt).toLocaleString()}</td>
                      <td><a onClick={() => onOpenTopic(t.id)}>查看</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
