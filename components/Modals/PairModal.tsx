import React, { useState } from 'react';
import { Tv, X, Check, KeyRound } from 'lucide-react';
import { TclRemoteClient } from '../../protocols/tclRemote';

interface PairModalProps {
  tcl: TclRemoteClient;
  onSuccess: () => void;
  onClose: () => void;
}

export const PairModal: React.FC<PairModalProps> = ({ tcl, onSuccess, onClose }) => {
  const [ip, setIp] = useState(tcl.ip);
  const [code, setCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('Listo para iniciar.');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!ip.trim()) {
      setStatusMsg('Por favor escribe la IP del televisor.');
      setIsError(true);
      return;
    }
    setLoading(true);
    setStatusMsg('Conectando al televisor para solicitar código...');
    setIsError(false);

    try {
      const res = await tcl.startPairing(ip);
      setStatusMsg(res.message);
      setIsSuccess(true);
      setStep(2);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message || err}`);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!code.trim()) {
      setStatusMsg('Escribe el código mostrado en la pantalla.');
      setIsError(true);
      return;
    }
    setLoading(true);
    setStatusMsg('Verificando código y conectando...');
    setIsError(false);

    try {
      await tcl.finishPairing(code);
      setStatusMsg('¡Televisor emparejado y conectado exitosamente!');
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      setStatusMsg(`Fallo al emparejar: ${err.message || err}`);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card pair-modal">
        <div className="modal-header">
          <div className="title-row">
            <Tv size={22} className="accent-icon" />
            <div>
              <h3>Emparejar TCL Android TV</h3>
              <p className="dim-sub">Protocolo Android TV Remote v2 seguro sobre Wi-Fi.</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="pair-instructions">
          <ol>
            <li>Enciende el televisor TCL y conéctalo a la <b>misma red Wi-Fi</b> que este equipo.</li>
            <li>Pulsa <b>Solicitar Código</b> para enviar la solicitud de enlace.</li>
            <li>Mira la pantalla del TCL: aparecerá un código de 4 a 6 dígitos.</li>
            <li>Introdúcelo abajo y pulsa <b>Confirmar Emparejamiento</b>.</li>
          </ol>
        </div>

        <div className="pair-form">
          <div className="form-group">
            <label>IP del Televisor:</label>
            <div className="input-with-button">
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.10.111"
                disabled={loading}
              />
              <button
                className="btn-accent"
                onClick={handleStart}
                disabled={loading}
              >
                {loading && step === 1 ? 'Solicitando...' : 'Solicitar Código'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Código mostrado en TV:</label>
            <div className="input-with-button">
              <div className="code-input-box">
                <KeyRound size={16} className="dim-icon" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ej: 123456"
                  disabled={loading}
                  maxLength={8}
                />
              </div>
              <button
                className="btn-green"
                onClick={handleConfirm}
                disabled={loading || !code.trim()}
              >
                <Check size={16} /> Confirmar
              </button>
            </div>
          </div>

          <div
            className={`status-box ${
              isError ? 'status-err' : isSuccess ? 'status-ok' : ''
            }`}
          >
            {statusMsg}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

