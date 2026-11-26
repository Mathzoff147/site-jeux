// =====================================================================
//  Chat vocal du salon (WebRTC, de navigateur à navigateur).
//  Le serveur ne fait que relayer la mise en relation (signalisation).
// =====================================================================
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

export class Voice {
  constructor({ send, myId, toast, onChange }) {
    Object.assign(this, { send, myId, toast, onChange });
    this.active = false; this.muted = false; this.stream = null;
    this.peers = new Map(); this.members = new Set(); this.speaking = new Set();
    this.audioBox = document.createElement('div'); this.audioBox.style.display = 'none'; document.body.appendChild(this.audioBox);
  }
  async join() {
    if (this.active) return;
    try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch { this.toast('🎙️ Accès au micro refusé. Autorisez-le dans votre navigateur.', 'err'); return; }
    this.active = true; this.muted = false;
    this.watchLevel();
    this.send({ a: 'join' });
    this.toast('🎙️ Vous êtes dans le salon vocal', 'ok');
    this.onChange();
  }
  leave(silent) {
    if (!this.active) { if (silent) { this.members.clear(); this.onChange(); } return; }
    if (!silent) this.send({ a: 'leave' });
    for (const id of [...this.peers.keys()]) this.drop(id);
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    clearInterval(this.levelT); this.ac?.close().catch(() => {}); this.ac = null;
    this.active = false; if (silent) this.members.clear();
    this.onChange();
  }
  toggleMute() { this.muted = !this.muted; this.stream?.getAudioTracks().forEach(t => { t.enabled = !this.muted; }); this.onChange(); }
  // détection de la parole (pour l'indicateur 🎙️ qui s'allume)
  watchLevel() {
    try {
      this.ac = new AudioContext(); const an = this.ac.createAnalyser(); an.fftSize = 512;
      this.ac.createMediaStreamSource(this.stream).connect(an);
      const buf = new Uint8Array(an.fftSize); let was = false;
      this.levelT = setInterval(() => {
        an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += (v - 128) ** 2;
        const on = !this.muted && Math.sqrt(s / buf.length) > 6;
        if (on !== was) { was = on; this.send({ a: 'speaking', on }); }
      }, 150);
    } catch { }
  }
  peer(id, initiator) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    this.stream?.getTracks().forEach(t => pc.addTrack(t, this.stream));
    pc.onicecandidate = e => { if (e.candidate) this.send({ a: 'signal', to: id, data: { ice: e.candidate } }); };
    pc.ontrack = e => {
      let el = this.audioBox.querySelector(`[data-p="${id}"]`);
      if (!el) { el = document.createElement('audio'); el.dataset.p = id; el.autoplay = true; this.audioBox.appendChild(el); }
      el.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) this.drop(id); };
    this.peers.set(id, pc);
    if (initiator) pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => this.send({ a: 'signal', to: id, data: { sdp: pc.localDescription } })).catch(() => {});
    return pc;
  }
  drop(id) { this.peers.get(id)?.close(); this.peers.delete(id); this.audioBox.querySelector(`[data-p="${id}"]`)?.remove(); }
  async onSignal(m) {
    if (m.a === 'members') { this.members = new Set(m.ids); this.onChange(); return; }
    if (m.a === 'speaking') { m.on ? this.speaking.add(m.id) : this.speaking.delete(m.id); this.onChange(); return; }
    if (!this.active) return;
    if (m.a === 'peers') for (const p of m.peers) this.peer(p.id, true); // le nouvel arrivant appelle les autres
    if (m.a === 'left') this.drop(m.id);
    if (m.a === 'signal') {
      const pc = this.peer(m.from, false), d = m.data;
      try {
        if (d.sdp) {
          await pc.setRemoteDescription(d.sdp);
          if (d.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); this.send({ a: 'signal', to: m.from, data: { sdp: pc.localDescription } }); }
        } else if (d.ice) await pc.addIceCandidate(d.ice);
      } catch (e) { console.warn('vocal', e); }
    }
  }
}
