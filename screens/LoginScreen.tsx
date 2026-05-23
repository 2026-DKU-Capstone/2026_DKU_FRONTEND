'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { setToken, setUserInfo } from '@/lib/auth';

interface LoginScreenProps {
  onLogin?: () => void;
}

type Tab = 'signup' | 'login';

interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  name: string;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [tab, setTab] = useState<Tab>('login');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchTab = (t: Tab) => { setTab(t); setError(''); };

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginForm.email, password: loginForm.password }),
      });
      if (res.ok) {
        const data: AuthResponse = await res.json();
        setToken(data.token);
        setUserInfo({ userId: data.userId, email: data.email, name: data.name });
        onLogin?.();
      } else {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setError('');
    if (signupForm.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: signupForm.email, password: signupForm.password, name: signupForm.name }),
      });
      if (res.ok) {
        const data: AuthResponse = await res.json();
        setToken(data.token);
        setUserInfo({ userId: data.userId, email: data.email, name: data.name });
        onLogin?.();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? body?.message ?? '회원가입에 실패했습니다. 다시 시도해주세요.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const fi: React.CSSProperties = {
    width: '100%', border: '1px solid var(--gray2)', borderRadius: 8,
    padding: '11px 13px', fontSize: 13, fontFamily: 'inherit',
    color: 'var(--navy)', background: '#fff', outline: 'none', transition: '.15s',
  };
  const fl: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: 'var(--gray5)', marginBottom: 6,
  };
  const btn: React.CSSProperties = {
    width: '100%', padding: '13px 16px', borderRadius: 8, border: 'none',
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: '.15s',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: 'var(--navy)', fontFamily: 'var(--font-ui)' }}>
      {/* 상단 바 */}
      <div style={{
        height: 64, borderBottom: '1px solid #F0D9C4',
        display: 'flex', alignItems: 'center', padding: '0 32px',
        background: '#fff', position: 'relative', zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
          <div style={{
            width: 30, height: 30, background: 'var(--navy)', borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 14, height: 14, border: '2.5px solid #fff', borderRadius: '50%',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 4, height: 4, background: '#fff', borderRadius: '50%',
              }} />
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.4px', color: 'var(--navy)' }}>GAGYEOL</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 24, fontSize: 13, color: 'var(--gray5)' }}>
          <a onClick={() => switchTab('login')} style={{ cursor: 'pointer', color: tab === 'login' ? 'var(--navy)' : 'inherit', fontWeight: tab === 'login' ? 600 : 400 }}>로그인</a>
          <a onClick={() => switchTab('signup')} style={{ cursor: 'pointer', color: tab === 'signup' ? 'var(--navy)' : 'inherit', fontWeight: tab === 'signup' ? 600 : 400 }}>회원가입</a>
        </div>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: -1, height: 1,
          background: 'linear-gradient(90deg,#FFD9B8 0%,#F4DDC8 60%,transparent 100%)',
        }} />
      </div>

      {/* 히어로 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.05fr 1fr',
        minHeight: 'calc(100vh - 64px)',
        background: 'linear-gradient(135deg,#EEF1F6 0%,#D8DEE8 60%,#C8D2E0 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, right: '46%', width: '60%', height: '140%',
          background: 'linear-gradient(135deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,0) 60%)',
          transform: 'skewX(-14deg)', transformOrigin: 'top', pointerEvents: 'none',
        }} />

        {/* 좌측 */}
        <div style={{
          padding: '90px 90px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          position: 'relative', zIndex: 2,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
            fontSize: 11, fontWeight: 700, letterSpacing: '1.4px',
            color: 'var(--blue)', background: '#fff',
            padding: '6px 14px', borderRadius: 100, marginBottom: 22,
          }}>PREMIUM SAAS</span>
          <h1 style={{
            fontSize: 54, fontWeight: 900, lineHeight: 1.12, color: 'var(--navy)',
            marginBottom: 24, letterSpacing: '-1px',
          }}>
            {tab === 'signup' ? <>계정<br />생성하기</> : <>다시<br />돌아오셨군요</>}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--gray5)', lineHeight: 1.85, marginBottom: 46 }}>
            가결의 스마트한 금융 자동화를 경험하세요.<br />
            차세대 인텔리전스로 재무 의사결정을 새로 정립합니다.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { ico: '✓', t: '실시간 자산 추적', d: '모든 재무와 자원을 하나의 공간에서 관리합니다.' },
              { ico: 'AI', t: 'AI 인사이트', d: '데이터 기반의 맞춤형 재무 분석 리포트를 제공합니다.' },
            ].map(f => (
              <div key={f.t} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: 'var(--navy)',
                  flexShrink: 0, marginTop: 1, border: '1px solid var(--gray2)',
                }}>{f.ico}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>{f.t}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray5)' }}>{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 우측 카드 */}
        <div style={{
          padding: '90px 90px 90px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 2,
        }}>
          <div style={{
            background: '#fff', borderRadius: 18, padding: '36px 38px',
            width: '100%', maxWidth: 420,
            boxShadow: '0 20px 50px rgba(28,43,74,.10), 0 4px 12px rgba(28,43,74,.04)',
          }}>
            {/* 탭 */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--gray2)', marginBottom: 24 }}>
              {(['login', 'signup'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  style={{
                    flex: 1, padding: '12px 0', textAlign: 'center',
                    fontSize: 14, fontWeight: 600,
                    color: tab === t ? 'var(--navy)' : 'var(--gray4)',
                    cursor: 'pointer', background: 'none',
                    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                    borderBottom: tab === t ? '2px solid var(--navy)' : '2px solid transparent',
                    marginBottom: -1, fontFamily: 'inherit', transition: '.15s',
                  }}
                >{t === 'signup' ? '회원가입' : '로그인'}</button>
              ))}
            </div>

            {error && (
              <div style={{
                fontSize: 12, color: 'var(--red)',
                background: 'var(--red-bg)', border: '1px solid #F5C6C6',
                borderRadius: 6, padding: '8px 12px', marginBottom: 14,
              }}>{error}</div>
            )}

            {tab === 'signup' ? (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <label style={fl}>이름</label>
                  <input
                    style={fi} placeholder="홍길동"
                    value={signupForm.name}
                    onChange={e => setSignupForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={fl}>이메일 주소</label>
                  <input
                    style={fi} placeholder="hong@company.com" type="email"
                    value={signupForm.email}
                    onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={fl}>비밀번호</label>
                  <input
                    style={fi} placeholder="8자 이상 입력" type="password"
                    value={signupForm.password}
                    onChange={e => setSignupForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray4)', margin: '6px 0 14px' }}>
                  가결 서비스 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.
                </div>
                <button
                  onClick={handleSignup}
                  disabled={loading}
                  style={{
                    ...btn,
                    background: 'var(--navy)', color: '#fff',
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >{loading ? '처리 중...' : '무료로 시작하기 →'}</button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <label style={fl}>이메일 주소</label>
                  <input
                    style={fi} placeholder="hong@company.com" type="email"
                    value={loginForm.email}
                    onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={fl}>비밀번호</label>
                  <input
                    style={fi} placeholder="비밀번호 입력" type="password"
                    value={loginForm.password}
                    onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                  />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 16, fontSize: 11, color: 'var(--gray5)',
                }}>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" /> 자동 로그인
                  </label>
                  <a style={{ cursor: 'pointer', color: 'var(--blue)' }}>비밀번호 찾기</a>
                </div>
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  style={{
                    ...btn,
                    background: 'var(--navy)', color: '#fff',
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >{loading ? '로그인 중...' : '로그인 →'}</button>
              </div>
            )}

            <div style={{
              display: 'flex', alignItems: 'center', margin: '18px 0', gap: 10,
              color: 'var(--gray4)', fontSize: 11,
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--gray2)' }} />
              또는
              <div style={{ flex: 1, height: 1, background: 'var(--gray2)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button style={{ ...btn, background: '#fff', color: 'var(--navy)', border: '1px solid var(--gray2)' }}>
                Google
              </button>
              <button style={{ ...btn, background: 'var(--kakao)', color: 'var(--kakao-text)' }}>
                Kakao
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FAB */}
      <div style={{
        position: 'fixed', right: 30, bottom: 30,
        display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50,
      }}>
        <button style={{
          width: 42, height: 42, borderRadius: '50%', background: 'var(--navy)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16, border: 'none',
          boxShadow: '0 8px 18px rgba(28,43,74,.25)',
        }}>+</button>
        <button style={{
          width: 42, height: 42, borderRadius: '50%', background: 'var(--blue)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16, border: 'none',
          boxShadow: '0 8px 18px rgba(28,43,74,.25)',
        }}>✉</button>
      </div>
    </div>
  );
}
