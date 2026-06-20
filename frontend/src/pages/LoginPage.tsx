import { useState } from 'react';

interface Props {
  onLogin: (u: string, p: string) => Promise<void>;
  error: string;
}

export default function LoginPage({ onLogin, error }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(error);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setErr('请输入用户名和密码'); return; }
    setLoading(true); setErr('');
    try {
      await onLogin(username.trim(), password);
    } catch (e: any) {
      setErr(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>🏘️ 小区议事厅</h1>
        <p className="subtitle">线上表决系统</p>
        {err && <div className="alert alert-error">{err}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        <div className="login-tip">
          <div><b>演示账号：</b></div>
          <div>管理员：admin / admin123</div>
          <div>住户：user001 ~ user005，密码均为 123456</div>
        </div>
      </div>
    </div>
  );
}
