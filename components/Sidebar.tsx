import React from 'react';
import {
  Plug,
  Printer,
  Image,
  Camera,
  QrCode,
  Lightbulb,
  Tv,
} from 'lucide-react';
import type { TabId } from '../types';

interface SidebarProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  printerConnected: boolean;
  ledConnected: boolean;
  tvConnected: boolean;
  tvPaired: boolean;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'conn', label: 'Conexiones', icon: <Plug size={18} /> },
  { id: 'printer', label: 'Impresora', icon: <Printer size={18} /> },
  { id: 'imagen', label: 'Imagen', icon: <Image size={18} /> },
  { id: 'camara', label: 'Cámara', icon: <Camera size={18} /> },
  { id: 'qr', label: 'QR Code', icon: <QrCode size={18} /> },
  { id: 'led', label: 'Tira LED', icon: <Lightbulb size={18} /> },
  { id: 'tcl', label: 'Control TV', icon: <Tv size={18} /> },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  printerConnected,
  ledConnected,
  tvConnected,
  tvPaired,
}) => {
  return (
    <aside className="sidebar">
      <div className="brand-header">
        <h2 className="brand-title">
          PRINTER STUDIO
          <span className="brand-accent"> + LED + TV</span>
        </h2>
        <p className="brand-sub">Imprime · Ilumina · Controla TV</p>
      </div>

      <nav className="nav-list">
        {TABS.map((tab) => {
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="status-badge-group">
          <div className="status-item">
            <span className="status-title">TCL Android TV</span>
            <div className="status-indicator">
              <span
                className={`dot ${tvConnected ? 'dot-ok' : tvPaired ? 'dot-warn' : 'dot-err'
                  }`}
              />
              <span className="status-val">
                {tvConnected
                  ? 'CONECTADA'
                  : tvPaired
                    ? 'EMPAREJADA'
                    : 'DESCONECTADA'}
              </span>
            </div>
          </div>

          <div className="status-item">
            <span className="status-title">Tira LED</span>
            <div className="status-indicator">
              <span className={`dot ${ledConnected ? 'dot-ok' : 'dot-err'}`} />
              <span className="status-val">
                {ledConnected ? 'CONECTADA' : 'DESCONECTADA'}
              </span>
            </div>
          </div>

          <div className="status-item">
            <span className="status-title">Impresora MX10</span>
            <div className="status-indicator">
              <span
                className={`dot ${printerConnected ? 'dot-ok' : 'dot-err'}`}
              />
              <span className="status-val">
                {printerConnected ? 'CONECTADA' : 'DESCONECTADA'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
