import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { UserInfo } from './types';
import LoginPage from './pages/LoginPage';
import ResidentHome from './pages/ResidentHome';
import AdminHome from './pages/AdminHome';
import TopicDetailPage from './pages/TopicDetailPage';

type View =
  | { name: 'login' }
  | { name: 'resident-home' }
  | { name: 'admin-home' }
  | { name: 'topic-detail'; topicId: string; from: 'resident' | 'admin' };

export default function App() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ name: 'login' });
  const [globalError, setGlobalError] = useState<string>('');

  // 首次挂载/登录异常时：刷新用户 + 跳转默认首页
  const loadMe = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
      if (me.role === 'ADMIN') setView({ name: 'admin-home' });
      else setView({ name: 'resident-home' });
    } catch (e: any) {
      api.clearToken();
      setUser(null);
      setView({ name: 'login' });
    } finally {
      setLoading(false);
    }
  }, []);

  // BUG⑤修复：只刷新用户状态（观察状态 / 连续未参与数），不改变当前视图
  // 用于：从议题详情返回、管理员操作触发观察状态变更、投票完成后等
  const refreshUser = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch (e: any) {
      // token 失效时退回登录
      api.clearToken();
      setUser(null);
      setView({ name: 'login' });
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  // BUG⑤修复：每次切回首页视图（从详情返回 / 首屏）时，主动刷新用户状态
  useEffect(() => {
    if (view.name === 'resident-home' || view.name === 'admin-home') {
      if (user) refreshUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.name]);

  const handleLogin = async (username: string, password: string) => {
    setGlobalError('');
    try {
      const resp = await api.login(username, password);
      api.setToken(resp.token);
      setUser(resp.user);
      if (resp.user.role === 'ADMIN') setView({ name: 'admin-home' });
      else setView({ name: 'resident-home' });
    } catch (e: any) {
      setGlobalError(e.message || '登录失败');
    }
  };

  const handleLogout = () => {
    api.clearToken();
    setUser(null);
    setView({ name: 'login' });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>加载中...</div>
      </div>
    );
  }

  if (view.name === 'login') {
    return <LoginPage onLogin={handleLogin} error={globalError} />;
  }

  const role = user!.role;
  const Header = (
    <div className="header">
      <h1>🏘️ 小区议事厅 · 线上表决系统</h1>
      <div className="header-right">
        <span>{role === 'ADMIN' ? '👨‍💼 管理员' : '👤 住户'}：{user!.realName}（{user!.roomNumber}）</span>
        {user!.status === 'OBSERVATION' && <span className="badge badge-orange">观察状态</span>}
        <button className="btn btn-secondary btn-sm" onClick={handleLogout}>退出登录</button>
      </div>
    </div>
  );

  const goTopicDetail = (topicId: string, from: 'resident' | 'admin') =>
    setView({ name: 'topic-detail', topicId, from });
  const goBack = () =>
    setView(role === 'ADMIN' ? { name: 'admin-home' } : { name: 'resident-home' });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {Header}
      <div style={{ flex: 1 }}>
        {view.name === 'resident-home' && <ResidentHome user={user!} onOpenTopic={(id) => goTopicDetail(id, 'resident')} />}
        {view.name === 'admin-home' && <AdminHome user={user!} onOpenTopic={(id) => goTopicDetail(id, 'admin')} />}
        {view.name === 'topic-detail' && (
          <TopicDetailPage
            topicId={view.topicId}
            user={user!}
            from={view.from}
            onBack={goBack}
            onChange={refreshUser}
          />
        )}
      </div>
    </div>
  );
}
