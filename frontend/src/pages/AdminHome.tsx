import { useState, useEffect } from 'react';
import { api } from '../api';
import {
  TopicListItem, STAGE_LABEL, RESULT_LABEL,
  UserInfo, Resident, TopicStage
} from '../types';

interface Props {
  user: UserInfo;
  onOpenTopic: (id: string) => void;
}

type Tab = 'topics' | 'residents';

export default function AdminHome({ user, onOpenTopic }: Props) {
  const [tab, setTab] = useState<Tab>('topics');
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [totalResidents, setTotalResidents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [showAddUser, setShowAddUser] = useState(false);
  const [nu, setNu] = useState({ username: '', password: '', realName: '', roomNumber: '' });
  const [addingUser, setAddingUser] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [tResp, rResp] = await Promise.all([api.listTopics(), api.listResidents()]);
      setTopics(tResp.topics);
      setTotalResidents(tResp.totalResidents);
      setResidents(rResp);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || '加载失败' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doCreate = async () => {
    if (!newTitle.trim() || !newDesc.trim()) {
      setMsg({ type: 'error', text: '请填写标题和描述' });
      return;
    }
    setCreating(true); setMsg(null);
    try {
      await api.createTopic(newTitle.trim(), newDesc.trim());
      setMsg({ type: 'success', text: '议题创建成功，已进入公示期' });
      setNewTitle(''); setNewDesc(''); setShowCreate(false);
      await load();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || '创建失败' });
    } finally { setCreating(false); }
  };

  const doAddUser = async () => {
    if (!nu.username.trim() || !nu.password || !nu.realName.trim() || !nu.roomNumber.trim()) {
      setMsg({ type: 'error', text: '请填写完整信息' }); return;
    }
    if (nu.password.length < 6) { setMsg({ type: 'error', text: '密码至少 6 位' }); return; }
    setAddingUser(true); setMsg(null);
    try {
      await api.createResident(nu);
      setMsg({ type: 'success', text: `住户账号创建成功：${nu.username}` });
      setNu({ username: '', password: '', realName: '', roomNumber: '' });
      setShowAddUser(false);
      await load();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || '创建失败' });
    } finally { setAddingUser(false); }
  };

  const doLift = async (id: string, name: string) => {
    if (!confirm(`确认解除「${name}」的观察状态并清零连续未参与次数吗？`)) return;
    try {
      await api.liftObservation(id);
      setMsg({ type: 'success', text: `已解除 ${name} 的观察状态` });
      await load();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || '解除失败' });
    }
  };

  const stageBadge = (s: TopicStage) =>
    s === 'PUBLIC_NOTICE' ? 'badge-blue'
    : s === 'DISCUSSION' ? 'badge-green'
    : s === 'VOTING' ? 'badge-orange'
    : 'badge-gray';

  const passedCount = topics.filter((t) => t.voteResult === 'PASSED').length;
  const rejectedCount = topics.filter((t) => t.voteResult === 'REJECTED').length;
  const ongoingCount = topics.filter((t) => t.stage !== 'ARCHIVED').length;
  const observationCount = residents.filter((r) => r.status === 'OBSERVATION').length;

  return (
    <div className="container">
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-box"><div className="num">{topics.length}</div><div className="lbl">议题总数</div></div>
        <div className="stat-box passed"><div className="num">{ongoingCount}</div><div className="lbl">进行中</div></div>
        <div className="stat-box agree"><div className="num">{passedCount}</div><div className="lbl">已通过</div></div>
        <div className="stat-box disagree"><div className="num">{rejectedCount}</div><div className="lbl">未通过</div></div>
        <div className="stat-box"><div className="num">{totalResidents}</div><div className="lbl">登记住户</div></div>
        <div className={`stat-box ${observationCount > 0 ? 'rejected' : ''}`}>
          <div className="num">{observationCount}</div>
          <div className="lbl">观察状态</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <div className={`tab ${tab === 'topics' ? 'active' : ''}`} onClick={() => setTab('topics')}>议题管理</div>
          <div className={`tab ${tab === 'residents' ? 'active' : ''}`} onClick={() => setTab('residents')}>住户管理</div>
        </div>
        <div>
          {tab === 'topics' && <button className="btn btn-success" onClick={() => setShowCreate(!showCreate)}>＋ 创建议题</button>}
          {tab === 'residents' && <button className="btn btn-success" onClick={() => setShowAddUser(!showAddUser)}>＋ 新增住户</button>}
        </div>
      </div>

      {showCreate && tab === 'topics' && (
        <div className="card" style={{ marginTop: 20, background: '#fafafa', border: '1px dashed #d9d9d9' }}>
          <h3>创建新议题</h3>
          <div className="alert alert-info">新议题将自动进入「公示期」，需公示满 7 天方可推进到讨论期</div>
          <div className="form-group">
            <label>议题标题</label>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="例如：关于小区加装电梯的方案表决" />
          </div>
          <div className="form-group">
            <label>议题描述</label>
            <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="详细说明议题背景、方案、影响范围等内容..."></textarea>
          </div>
          <button className="btn btn-success" onClick={doCreate} disabled={creating}>
            {creating ? '创建中...' : '确认创建'}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>取消</button>
        </div>
      )}

      {showAddUser && tab === 'residents' && (
        <div className="card" style={{ marginTop: 20, background: '#fafafa', border: '1px dashed #d9d9d9' }}>
          <h3>新增住户账号</h3>
          <div className="form-group">
            <label>用户名（登录用）</label>
            <input type="text" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} placeholder="如 user006" />
          </div>
          <div className="form-group">
            <label>初始密码（至少6位）</label>
            <input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} placeholder="如 123456" />
          </div>
          <div className="form-group">
            <label>真实姓名</label>
            <input type="text" value={nu.realName} onChange={(e) => setNu({ ...nu, realName: e.target.value })} placeholder="如 孙八" />
          </div>
          <div className="form-group">
            <label>房号</label>
            <input type="text" value={nu.roomNumber} onChange={(e) => setNu({ ...nu, roomNumber: e.target.value })} placeholder="如 2-102" />
          </div>
          <button className="btn btn-success" onClick={doAddUser} disabled={addingUser}>
            {addingUser ? '创建中...' : '确认创建'}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAddUser(false)}>取消</button>
        </div>
      )}

      {loading && <div className="card" style={{ marginTop: 20 }}>加载中...</div>}

      {!loading && tab === 'topics' && (
        <div style={{ marginTop: 20 }}>
          {topics.length === 0 && <div className="card empty">暂无议题，点击右上方「创建议题」开始</div>}
          {topics.map((t) => {
            const next = (() => {
              const m: Record<TopicStage, string> = { PUBLIC_NOTICE: 'DISCUSSION', DISCUSSION: 'VOTING', VOTING: 'ARCHIVED', ARCHIVED: '' };
              return m[t.stage];
            })();
            return (
              <div key={t.id} className="topic-list-item" onClick={() => onOpenTopic(t.id)}>
                <h3>
                  <span>{t.title}</span>
                  <span style={{ display: 'flex', gap: 8 }}>
                    <span className={`badge ${stageBadge(t.stage as TopicStage)}`}>{STAGE_LABEL[t.stage as TopicStage]}</span>
                    {t.stage === 'ARCHIVED' && (
                      <span className={`badge ${t.voteResult === 'PASSED' ? 'badge-green' : 'badge-red'}`}>
                        {RESULT_LABEL[t.voteResult]}
                      </span>
                    )}
                  </span>
                </h3>
                <div className="desc">{t.description}</div>
                <div className="topic-meta">
                  <span>创建：{new Date(t.createdAt).toLocaleString()}</span>
                  <span>已参与：{t._count.votes} / {totalResidents} 户</span>
                  <span>阶段变更：{t._count.stageLogs} 次</span>
                  {next && <span style={{ color: '#1890ff' }}>下一步：推进至 {STAGE_LABEL[next as TopicStage]} →</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && tab === 'residents' && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2>住户账号列表（{residents.length}）</h2>
          {residents.length === 0 && <div className="empty">暂无住户</div>}
          {residents.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>用户名</th><th>姓名</th><th>房号</th>
                  <th>状态</th><th>连续未参与</th><th>注册时间</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {residents.map((r) => (
                  <tr key={r.id}>
                    <td>{r.username}</td>
                    <td>{r.realName}</td>
                    <td>{r.roomNumber}</td>
                    <td>
                      {r.status === 'OBSERVATION'
                        ? <span className="badge badge-orange">观察状态</span>
                        : <span className="badge badge-green">正常</span>}
                    </td>
                    <td>
                      {r.consecutiveMiss > 0
                        ? <span style={{ color: r.consecutiveMiss >= 2 ? '#cf1322' : '#d46b08', fontWeight: 600 }}>{r.consecutiveMiss} 次</span>
                        : <span style={{ color: '#8c8c8c' }}>0</span>}
                    </td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      {r.status === 'OBSERVATION' && (
                        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); doLift(r.id, r.realName); }}>
                          解除观察
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
