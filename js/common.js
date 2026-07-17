// Utilidades compartidas entre juego.js y marcador.js.
// Se carga como <script> normal (no es un módulo), así que estas funciones
// quedan disponibles para los scripts que se incluyan después de este.

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
