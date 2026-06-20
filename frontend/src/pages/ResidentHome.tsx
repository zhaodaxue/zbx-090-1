import { useState, useEffect } from 'react';
import { api } from '../api';
import { TopicListItem, STAGE_LABEL, RESULT_LABEL, UserInfo, VoteRecord, TopicStage, VoteResult } from '../types';

interface Props {
  user: UserInfo;
  onOpenTopic: (id: string) => void;
}

type Tab = 'current' | 'archive' | 'my';

export default function ResidentHome({ user, onOpenTopic }: Props) {
  const [tab, setTab] = useState<Tab>('current');
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [myVotes, setMyVotes] = useState<VoteRecord[]>([]);
  const [missedTopics, setMissedTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalResidents, setTotalResidents] = useState(0);

  const load = async () => {
    setLoading(true);
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
  };

  useEffect(() => { load(); }, []);

  const currentTopics = topics.filter((t) => t.stage !== 'ARCHIVED');
  const archivedTopics = topics.filter((t) => t.stage === 'ARCHIVED');

  const stageBadgeClass = (s: string) =>
    s === 'PUBLIC_NOTICE' ? 'badge-blue'
    : s === 'DISCUSSION' ? 'badge-green'
    : s === 'VOTING' ? 'badge-orange'
    : 'badge-gray';

  return (
    <div className="container">
      {user.status === 'OBSERVATION' && (
        <div className="alert alert-warning">
          ⚠️ 您的账号处于 <b>观察状态</b>（连续 {user.consecutiveMiss} 次未参与表决），目前无法投票，请联系物业人工解除。
        </div>
      )}

      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: '#8c8c8c' }}>住户信息</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginTop: 2 }}>
              {user.realName} · {user.roomNumber}
              {user.consecutiveMiss != null && user.consecutiveMiss > 0 && (
                <span className="badge badge-orange" style={{ marginLeft: 8 }}>连续未参与 {user.consecutiveMiss} 次</span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#8c8c8c' }}>
            小区登记住户共 <b style={{ color: '#1890ff' }}>{totalResidents}</b> 户
          </div>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'current' ? 'active' : ''}`} onClick={() => setTab('current')}>
          进行中议题 ({currentTopics.length})
        </div>
        <div className={`tab ${tab === 'archive' ? 'active' : ''}`} onClick={() => setTab('archive')}>
          历史归档 ({archivedTopics.length})
        </div>
        <div className={`tab ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>
          我的参与记录
        </div>
      </div>

      {loading && <div className="card">加载中...</div>}

      {!loading && tab === 'current' && (
        <div>
          {currentTopics.length === 0 && <div className="card empty">暂无进行中的议题</div>}
          {currentTopics.map((t) => (
            <div key={t.id} className="topic-list-item" onClick={() => onOpenTopic(t.id)}>
              <h3>
                <span>{t.title}</span>
                <span className={`badge ${stageBadgeClass(t.stage)}`}>{STAGE_LABEL[t.stage as TopicStage]}</span>
              </h3>
              <div className="desc">{t.description}</div>
              <div className="topic-meta">
                <span>创建人：{t.creator.realName}</span>
                <span>创建时间：{new Date(t.createdAt).toLocaleString()}</span>
                <span>已有 {t._count.votes} 人参与</span>
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
                    {RESULT_LABEL[t.voteResult]}
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
                      <td><span className={`badge ${t.voteResult === 'PASSED' ? 'badge-green' : 'badge-red'}`}>{RESULT_LABEL[t.voteResult as VoteResult]}</span></td>
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
