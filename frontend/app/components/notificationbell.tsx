import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/app/context/notification';
import "@/app/style/notification-bell.css";

const X = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

const Check = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

const CheckCheck = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 12 9 19 21 7"/><polyline points="3 6 9 13 21 1"/></svg>
);

const TYPE_COLORS: Record<string, string> = {
  building: '#3B82F6',
  concern:  '#8B5CF6',
  staff:    '#10B981',
  status:   '#F97316',
  priority: '#EF4444',
};

const TYPE_LABELS: Record<string, string> = {
  building: 'Building',
  concern:  'Concern',
  staff:    'Staff',
  status:   'Status',
  priority: 'Priority',
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [bellChecked, setBellChecked] = useState(false);

  // Animate bell when new unread arrives
  useEffect(() => {
    if (unreadCount > 0) setBellChecked(true);
    else setBellChecked(false);
  }, [unreadCount]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  };

  return (
    <div className="nb-root" ref={dropdownRef}>
      {/* Uiverse bell button */}
      <button
        className="nb-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        type="button"
      >
        <label className="nb-container" onClick={(e) => e.preventDefault()}>
          <input type="checkbox" readOnly checked={bellChecked} />
          {/* outline bell */}
          <svg fill="currentColor" viewBox="0 0 448 512" className="bell-regular" xmlns="http://www.w3.org/2000/svg">
            <path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"/>
          </svg>
          {/* solid bell */}
          <svg fill="currentColor" viewBox="0 0 448 512" className="bell-solid" xmlns="http://www.w3.org/2000/svg">
            <path d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"/>
          </svg>
        </label>
        {unreadCount > 0 && (
          <span className="nb-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="nb-dropdown">
          <div className="nb-dropdown-header">
            <div>
              <h3 className="nb-dropdown-title">Notifications</h3>
              {unreadCount > 0 && <p className="nb-dropdown-sub">{unreadCount} unread</p>}
            </div>
            <div className="nb-dropdown-actions">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="nb-icon-btn nb-icon-btn--blue" title="Mark all as read" type="button">
                  <CheckCheck size={15} />
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} className="nb-icon-btn nb-icon-btn--gray" title="Clear all" type="button">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="nb-list">
            {notifications.length === 0 ? (
              <div className="nb-empty">
                <svg viewBox="0 0 448 512" width="36" height="36" fill="currentColor">
                  <path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"/>
                </svg>
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`nb-item${!n.read ? ' nb-item--unread' : ''}`}
                  onClick={() => markAsRead(n.id)}
                >
                  <div className="nb-item-body">
                    <div className="nb-item-top">
                      <span
                        className="nb-type-badge"
                        style={{
                          backgroundColor: TYPE_COLORS[n.type] + '20',
                          color: TYPE_COLORS[n.type],
                        }}
                      >
                        {TYPE_LABELS[n.type] || n.type}
                      </span>
                      {!n.read && <span className="nb-unread-dot" />}
                    </div>
                    <p className="nb-item-msg">{n.message}</p>
                    <p className="nb-item-time">{formatTime(n.timestamp)}</p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                      className="nb-read-btn"
                      title="Mark as read"
                      type="button"
                    >
                      <Check size={13} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}