'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface GNBProps {
  activeMenu?: string;
  onMenuClick?: (menu: string) => void;
  workspaceName?: string;
}

const MENUS = ['대시보드', '지출결의', '결재', '규정관리', '양식지'] as const;
type Menu = typeof MENUS[number];

const MENU_ROUTES: Record<Menu, string> = {
  '대시보드': '/dashboard',
  '지출결의': '/expense-board',
  '결재':     '/approvals',
  '규정관리': '/regulation',
  '양식지':   '/forms',
};

export default function GNB({
  activeMenu = '대시보드',
  onMenuClick,
  workspaceName = '내 워크스페이스',
}: GNBProps) {
  const router = useRouter();
  const [wsOpen, setWsOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wsOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false);
    };
    window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, [wsOpen]);

  const handleClick = (m: Menu) => {
    if (onMenuClick) onMenuClick(m);
    else router.push(MENU_ROUTES[m]);
  };

  return (
    <nav style={{
      height: 'var(--gnb-h)', background: '#fff',
      borderBottom: '1px solid var(--gray2)',
      display: 'flex', alignItems: 'center',
      padding: '0 32px',
      position: 'sticky', top: 0, zIndex: 200,
    }}>
      {/* Logo */}
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
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
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', letterSpacing: '0.4px' }}>GAGYEOL</span>
      </Link>

      {/* Separator */}
      <div style={{ width: 1, height: 18, background: 'var(--gray3)', margin: '0 18px' }} />

      {/* Workspace switcher */}
      <div ref={wsRef} style={{ position: 'relative' }}>
        <div
          onClick={() => setWsOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
            background: wsOpen ? 'var(--gray1)' : 'transparent',
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'var(--blue)', color: '#fff',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{workspaceName.slice(0, 1)}</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{workspaceName}</span>
          <span style={{ fontSize: 10, color: 'var(--gray4)' }}>▾</span>
        </div>
        {wsOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6,
            background: '#fff', border: '1px solid var(--gray2)', borderRadius: 8,
            boxShadow: '0 6px 16px rgba(28,43,74,.12)',
            minWidth: 180, zIndex: 250, overflow: 'hidden',
          }}>
            {[
              { label: '그룹 변경',   route: '/group-select' },
              { label: '그룹 설정',   route: '/group-settings' },
            ].map(item => (
              <button
                key={item.route}
                onClick={() => { setWsOpen(false); router.push(item.route); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', background: 'none', border: 'none',
                  fontSize: 13, color: 'var(--navy)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >{item.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', marginLeft: 24 }}>
        {MENUS.map(m => (
          <button
            key={m}
            onClick={() => handleClick(m)}
            style={{
              fontSize: 14,
              fontWeight: m === activeMenu ? 700 : 500,
              color: m === activeMenu ? 'var(--navy)' : 'var(--gray4)',
              padding: '0 18px', height: 'var(--gnb-h)',
              display: 'flex', alignItems: 'center',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              borderBottom: m === activeMenu ? '2.5px solid var(--navy)' : '2.5px solid transparent',
              cursor: 'pointer',
              background: 'none', fontFamily: 'inherit',
            }}
          >{m}</button>
        ))}
      </div>

      {/* Right */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          aria-label="설정"
          style={{
            width: 30, height: 30,
            border: '1px solid var(--gray2)', borderRadius: '50%',
            background: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gray4)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
        <button
          aria-label="도움말"
          style={{
            width: 30, height: 30,
            border: '1px solid var(--gray2)', borderRadius: '50%',
            background: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gray4)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 17h.01" strokeLinecap="round" />
          </svg>
        </button>
        <div
          aria-label="메뉴"
          style={{
            display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer', width: 22,
          }}
        >
          <span style={{ height: 1.5, background: 'var(--navy)', borderRadius: 1, display: 'block' }} />
          <span style={{ height: 1.5, background: 'var(--navy)', borderRadius: 1, display: 'block' }} />
          <span style={{ height: 1.5, background: 'var(--navy)', borderRadius: 1, display: 'block' }} />
        </div>
      </div>
    </nav>
  );
}
