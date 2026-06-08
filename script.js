// ============================================================================
// SISTEMA DE EQUIPOS v3.0 — 100% Client-side (GitHub Pages compatible)
// ============================================================================

// ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
const datos = {
    estudiantes:  [],
    equipos:      [],
    actividades:  [],
    adversidades: [],
    historialPuntuacion: []
};

let usuarioActual = null;
const PASSWORD = '1234';

const ARCHIVO_ESTUDIANTES = 'Estudiantes_y_Roles.csv';
const ARCHIVO_ACTIVIDADES = 'Actividades_Completas_Unico_Archivo.csv';
const ARCHIVO_ADVERSIDADES = 'Adversidades_Directas.csv';

// Estado del módulo secreto
const estadoSecreto = { visible: false, clicks: 0 };

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

function normalizar(str) {
    return String(str).toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function busquedaFuzzy(patron, texto) {
    patron = normalizar(patron);
    texto  = normalizar(texto);
    let pi = 0;
    for (let i = 0; i < texto.length; i++) {
        if (patron[pi] === texto[i]) pi++;
        if (pi === patron.length) return true;
    }
    return false;
}

function inicialAlumno(nombre) {
    const partes = String(nombre).trim().split(/\s+/);
    return partes.length >= 2
        ? (partes[0][0] + partes[1][0]).toUpperCase()
        : partes[0].substring(0, 2).toUpperCase();
}

function mostrarToast(msg, tipo = 'ok') {
    let toast = document.getElementById('toastGlobal');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastGlobal';
        toast.style.cssText = `
            position:fixed; bottom:90px; left:50%; transform:translateX(-50%) translateY(20px);
            background:#2C3E50; color:white; padding:12px 22px; border-radius:30px;
            font-family:Nunito,sans-serif; font-weight:700; font-size:14px;
            box-shadow:0 8px 24px rgba(0,0,0,.25); z-index:9999;
            opacity:0; transition:all .35s cubic-bezier(0.34,1.2,0.64,1);
            pointer-events:none; max-width:90vw; text-align:center;
        `;
        document.body.appendChild(toast);
    }
    const colores = { ok: '#27ae60', error: '#e74c3c', info: '#2980b9', warn: '#e67e22' };
    toast.style.background = colores[tipo] || '#2C3E50';
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3200);
}

// ─── PERSISTENCIA ─────────────────────────────────────────────────────────────

function guardarDatos() {
    try {
        localStorage.setItem('sistemaEquipos_v3', JSON.stringify(datos));
    } catch (e) {
        console.warn('localStorage no disponible:', e);
    }
}

function cargarDatos() {
    try {
        const raw = localStorage.getItem('sistemaEquipos_v3');
        if (raw) {
            const parsed = JSON.parse(raw);
            Object.assign(datos, parsed);
        }
    } catch (e) {
        console.warn('Error al cargar datos guardados:', e);
    }
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────

function mostrarLoginAlumno() {
    document.getElementById('loginAlumno').classList.remove('hidden');
    document.getElementById('loginProfesor').classList.add('hidden');
    setTimeout(() => document.getElementById('inputNombreAlumno').focus(), 50);
}

function mostrarLoginProfesor() {
    document.getElementById('loginProfesor').classList.remove('hidden');
    document.getElementById('loginAlumno').classList.add('hidden');
    setTimeout(() => document.getElementById('inputPasswordProfesor').focus(), 50);
}

function volverLogin() {
    document.getElementById('loginAlumno').classList.add('hidden');
    document.getElementById('loginProfesor').classList.add('hidden');
}

function loginAlumnoFunc() {
    const nombre = document.getElementById('inputNombreAlumno').value.trim();
    if (!nombre) { mostrarToast('Escribe tu nombre', 'warn'); return; }

    if (datos.estudiantes.length === 0) {
        mostrarToast('El profesor aún no ha cargado la lista de alumnos', 'warn');
        return;
    }

    const estudiante = datos.estudiantes.find(e => busquedaFuzzy(nombre, e.nombre));
    if (!estudiante) {
        mostrarToast('Nombre no encontrado. Verifica la ortografía.', 'error');
        return;
    }

    usuarioActual = { tipo: 'alumno', ...estudiante };
    abrirPanelAlumno();
}

function loginProfesorFunc() {
    const pwd = document.getElementById('inputPasswordProfesor').value;
    if (pwd !== PASSWORD) { mostrarToast('Contraseña incorrecta', 'error'); return; }
    usuarioActual = { tipo: 'profesor' };
    abrirPanelProfesor();
}

function abrirPanelAlumno() {
    document.getElementById('pantallaLogin').classList.add('hidden');
    document.getElementById('panelAlumno').classList.remove('hidden');

    document.getElementById('nombreAlumnoHeader').textContent = usuarioActual.nombre;
    document.getElementById('rolBadge').textContent = usuarioActual.rol;
    actualizarPuntos();
    mostrarFichas();
    actualizarCupoInfo();
}

function abrirPanelProfesor() {
    document.getElementById('pantallaLogin').classList.add('hidden');
    document.getElementById('panelProfesor').classList.remove('hidden');
    renderizarEstadoSistema();
    renderizarListaEstudiantesProf();
    renderizarActividadesProf();
}

function logout() {
    usuarioActual = null;
    estadoSecreto.visible = false;
    estadoSecreto.clicks  = 0;
    document.getElementById('pantallaLogin').classList.remove('hidden');
    document.getElementById('panelAlumno').classList.add('hidden');
    document.getElementById('panelProfesor').classList.add('hidden');
    document.getElementById('moduloPasos').classList.add('hidden');
    document.getElementById('cajaSecretaPanel').classList.add('hidden');
    // Resetear tabs al abrir de nuevo
    ['tabFichas','tabMiEquipo','tabRuleta','tabRanking','tabLogros'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const tf = document.getElementById('tabFichas');
    if (tf) tf.classList.remove('hidden');
}

// ─── MÓDULO SECRETO DE PASOS (Bug fix: botón de cierre completo) ──────────────

document.addEventListener('click', function(e) {
    if (e.target.id === 'nombreAlumnoHeader') {
        estadoSecreto.clicks++;
        if (estadoSecreto.clicks >= 5) {
            estadoSecreto.clicks = 0;
            document.getElementById('moduloPasos').classList.remove('hidden');
            mostrarToast('👣 ¡Módulo secreto desbloqueado!', 'info');
        }
    }
});

function toggleCajaSecreta() {
    const caja = document.getElementById('cajaSecretaPanel');
    if (estadoSecreto.visible) {
        cerrarModuloSecreto();
    } else {
        estadoSecreto.visible = true;
        caja.classList.remove('hidden');
        if (usuarioActual) {
            document.getElementById('totalPasos').textContent = usuarioActual.pasos || 0;
        }
    }
}

/**
 * Bug fix #1 — Cierra el módulo secreto completamente:
 * oculta la caja flotante, reinicia el estado y devuelve
 * la interfaz a su estado normal.
 */
function cerrarModuloSecreto() {
    estadoSecreto.visible = false;
    estadoSecreto.clicks  = 0;
    document.getElementById('cajaSecretaPanel').classList.add('hidden');
    document.getElementById('moduloPasos').classList.add('hidden');
    document.getElementById('inputPasos').value = '';
}

function registrarPasos() {
    const pasos = parseInt(document.getElementById('inputPasos').value) || 0;
    if (pasos <= 0) { mostrarToast('Ingresa un número mayor a 0', 'warn'); return; }

    usuarioActual.pasos = (usuarioActual.pasos || 0) + pasos;

    // Actualizar también en el array de estudiantes
    const est = datos.estudiantes.find(e => e.id === usuarioActual.id);
    if (est) est.pasos = usuarioActual.pasos;

    const equipo = datos.equipos.find(eq => eq.id === usuarioActual.equipoId);
    if (equipo) equipo.pasos = (equipo.pasos || 0) + pasos;

    document.getElementById('totalPasos').textContent = usuarioActual.pasos;
    document.getElementById('inputPasos').value = '';
    guardarDatos();
    mostrarToast(`✅ +${pasos} pasos registrados (total: ${usuarioActual.pasos})`, 'ok');
}

// ─── PROCESAMIENTO CSV (Bug fix #3 — FileReader nativo, sin servidor) ─────────

/**
 * Procesa directamente el archivo CSV usando FileReader nativo del navegador.
 * Compatible 100% con GitHub Pages (sin servidor, sin fetch local).
 */
function procesarCSVDirecto(tipo, inputEl) {
    const archivo = inputEl.files[0];
    const statusEl = document.getElementById('status' + tipo.charAt(0).toUpperCase() + tipo.slice(1));

    if (!archivo) {
        if (statusEl) { statusEl.textContent = 'No se seleccionó archivo.'; statusEl.className = 'status-carga error'; }
        return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
        if (statusEl) { statusEl.textContent = '❌ Error al leer el archivo.'; statusEl.className = 'status-carga error'; }
        mostrarToast('Error al leer el archivo CSV', 'error');
    };

    reader.onload = (e) => {
        try {
            const contenido = e.target.result
                .replace(/^\uFEFF/, '')   // Quitar BOM UTF-8
                .trim();

            const lineas = contenido.split(/\r?\n/).filter(l => l.trim().length > 0);

            if (lineas.length === 0) {
                if (statusEl) { statusEl.textContent = '⚠️ El archivo está vacío.'; statusEl.className = 'status-carga error'; }
                return;
            }

            if (tipo === 'estudiantes') {
                _parsearEstudiantes(lineas, statusEl);
            } else if (tipo === 'actividades') {
                _parsearActividades(lineas, statusEl);
            } else if (tipo === 'adversidades') {
                _parsearAdversidades(lineas, statusEl);
            }

            guardarDatos();
            renderizarEstadoSistema();
            renderizarListaEstudiantesProf();
            renderizarActividadesProf();

        } catch (err) {
            console.error('Error al parsear CSV:', err);
            if (statusEl) { statusEl.textContent = '❌ Error al procesar: ' + err.message; statusEl.className = 'status-carga error'; }
            mostrarToast('Error al procesar el CSV: ' + err.message, 'error');
        }
    };

    reader.readAsText(archivo, 'UTF-8');
}

function _parsearEstudiantes(lineas, statusEl) {
    const rolesValidos = ['Líder', 'Comunicador', 'Ejecutor', 'Estratega', 'Motivador'];
    const inicio = normalizar(lineas[0]).includes('nombre') ? 1 : 0;
    let contador = 0;
    const nuevos = [];

    for (let i = inicio; i < lineas.length; i++) {
        const partes = lineas[i].split(',').map(p => p.trim()).filter(p => p);
        if (partes.length < 2) continue;

        const nombre = partes[0];
        // Buscar el rol en cualquier columna (el CSV real puede tener encabezado "Rol Designado")
        const rolRaw = partes[1];
        const rol = rolesValidos.find(r => normalizar(rolRaw).includes(normalizar(r))) || null;

        if (!nombre || !rol) continue;

        nuevos.push({
            id:               Date.now() + i + Math.random(),
            nombre:           nombre,
            rol:              rol,
            puntosPersonales: 0,
            puntosEquipo:     0,
            pasos:            0,
            logros:           [],
            equipoId:         null
        });
        contador++;
    }

    if (contador > 0) {
        datos.estudiantes = nuevos;
        if (statusEl) { statusEl.textContent = `✅ ${contador} estudiantes cargados.`; statusEl.className = 'status-carga ok'; }
        mostrarToast(`✅ ${contador} estudiantes cargados`, 'ok');
    } else {
        if (statusEl) { statusEl.textContent = '❌ Sin estudiantes válidos. Verifica formato (Nombre,Rol).'; statusEl.className = 'status-carga error'; }
        mostrarToast('Sin estudiantes válidos en el CSV', 'error');
    }
}

function _parsearActividades(lineas, statusEl) {
    const inicio = normalizar(lineas[0]).includes('nombre') ? 1 : 0;
    const nuevas = [];

    for (let i = inicio; i < lineas.length; i++) {
        const partes = lineas[i].split(',').map(p => p.trim()).filter(p => p);
        if (!partes[0]) continue;
        nuevas.push({ id: i, nombre: partes[0], descripcion: partes[1] || 'Sin descripción' });
    }

    // Siempre añadir el módulo secreto
    nuevas.push({ id: 999, nombre: 'Caminata 🚶', descripcion: 'Módulo secreto — registra tus pasos.' });

    datos.actividades = nuevas;
    const c = nuevas.length - 1;
    if (statusEl) { statusEl.textContent = `✅ ${c} actividades cargadas.`; statusEl.className = 'status-carga ok'; }
    mostrarToast(`✅ ${c} actividades cargadas`, 'ok');
}

function _parsearAdversidades(lineas, statusEl) {
    const nuevas = lineas
        .filter(l => l.trim())
        .map((l, i) => ({ id: i, texto: l.trim() }));

    datos.adversidades = nuevas;
    if (statusEl) { statusEl.textContent = `✅ ${nuevas.length} adversidades cargadas.`; statusEl.className = 'status-carga ok'; }
    mostrarToast(`✅ ${nuevas.length} adversidades cargadas`, 'ok');
}

// ─── PANEL PROFESOR — RENDERIZADO ─────────────────────────────────────────────

function renderizarEstadoSistema() {
    const el = document.getElementById('estadoSistema');
    if (!el) return;

    const sinEquipo = datos.estudiantes.filter(e => !e.equipoId).length;
    el.innerHTML = `
        <div class="stat-card">
            <span class="stat-num">${datos.estudiantes.length}</span>
            <div class="stat-label">👨‍🎓 Estudiantes</div>
        </div>
        <div class="stat-card">
            <span class="stat-num">${datos.equipos.length}</span>
            <div class="stat-label">👥 Equipos</div>
        </div>
        <div class="stat-card">
            <span class="stat-num">${datos.actividades.length}</span>
            <div class="stat-label">🎮 Actividades</div>
        </div>
        <div class="stat-card">
            <span class="stat-num" style="color:#e74c3c">${sinEquipo}</span>
            <div class="stat-label">🚶 Sin equipo</div>
        </div>
    `;
}

function renderizarListaEstudiantesProf() {
    const el = document.getElementById('listaEstudiantesProf');
    if (!el) return;

    if (datos.estudiantes.length === 0) {
        el.innerHTML = '<p style="padding:16px;color:#7F8C8D;font-size:13px;">Ningún estudiante cargado aún.</p>';
        return;
    }

    el.innerHTML = datos.estudiantes.map((est, i) => `
        <div class="lista-est-item">
            <strong>${i + 1}. ${est.nombre}</strong>
            <span class="rol-chip rol-${est.rol}">${est.rol}</span>
        </div>
    `).join('');
}

function renderizarActividadesProf() {
    const el = document.getElementById('actividadesProfesor');
    if (!el) return;

    if (datos.actividades.length === 0) {
        el.innerHTML = '<p style="color:#7F8C8D;font-size:13px;">Ninguna actividad cargada.</p>';
        return;
    }

    el.innerHTML = datos.actividades.map(a => `
        <div class="actividad-item">
            <strong>${a.nombre}</strong>
            <span>${a.descripcion}</span>
        </div>
    `).join('');
}

/**
 * Dashboard de Equipos del Profesor (Bug fix #4 — módulo completo)
 * Muestra tarjetas por equipo y lista de alumnos rezagados.
 */
function actualizarEquiposProf() {
    const container = document.getElementById('equiposProfesor');
    const rezagados = document.getElementById('alumnosSinEquipo');

    // ── Equipos
    if (datos.equipos.length === 0) {
        container.innerHTML = `
            <div class="equipo-sin-datos">
                <div style="font-size:48px;margin-bottom:12px">👥</div>
                <p>Aún no se han formado equipos.<br>Los alumnos los crean desde su panel.</p>
            </div>`;
    } else {
        container.innerHTML = datos.equipos.map((eq, idx) => {
            const miembrosHTML = eq.miembros.map(m => `
                <div class="equipo-miembro-row">
                    <div class="mini-avatar">${inicialAlumno(m.nombre)}</div>
                    <div>
                        <div style="font-weight:700">${m.nombre}</div>
                        <div style="font-size:11px;color:#7F8C8D">${m.rol}</div>
                    </div>
                </div>
            `).join('');

            return `
                <div class="equipo-card-prof">
                    <div class="equipo-card-header">
                        <span class="equipo-card-titulo">⚡ Equipo ${idx + 1}</span>
                        <span class="equipo-card-pts">${eq.puntosEquipo || 0} pts</span>
                    </div>
                    <div class="equipo-card-body">${miembrosHTML}</div>
                </div>
            `;
        }).join('');
    }

    // ── Alumnos sin equipo
    const sinEquipo = datos.estudiantes.filter(e => !e.equipoId);
    if (sinEquipo.length === 0) {
        rezagados.innerHTML = '<div class="rezagado-sin-datos">✅ ¡Todos los alumnos están en un equipo!</div>';
    } else {
        rezagados.innerHTML = sinEquipo.map(e => `
            <div class="rezagado-item">
                <div class="rezagado-avatar">${inicialAlumno(e.nombre)}</div>
                <div>
                    <div style="font-weight:700;font-size:13px">${e.nombre}</div>
                    <span class="rol-chip rol-${e.rol}" style="font-size:10px">${e.rol}</span>
                </div>
            </div>
        `).join('');
    }

    actualizarSelectEquipos();
}

function actualizarSelectEquipos() {
    const select = document.getElementById('selectEquipo');
    if (!select) return;
    select.innerHTML = '<option value="">-- Selecciona un equipo --</option>';
    datos.equipos.forEach((eq, idx) => {
        const miembros = eq.miembros.map(m => m.nombre).join(', ');
        const opt = document.createElement('option');
        opt.value = eq.id;
        opt.textContent = `Equipo ${idx + 1}: ${miembros} (${eq.puntosEquipo || 0} pts)`;
        select.appendChild(opt);
    });
}

// ─── FICHAS Y SELECCIÓN DE EQUIPOS ────────────────────────────────────────────

function actualizarCupoInfo() {
    const el = document.getElementById('cupoInfo');
    if (!el) return;
    const equipo = datos.equipos.find(eq => eq.id === usuarioActual.equipoId);
    const actual = equipo ? equipo.miembros.length : 1;
    const max = 3;
    const libre = max - actual;

    if (libre <= 0) {
        el.textContent = '🔒 Tu equipo está completo (3/3 miembros)';
        el.className = 'cupo-info completo';
    } else {
        el.textContent = `👥 Tu equipo: ${actual}/${max} — puedes invitar a ${libre} persona${libre > 1 ? 's' : ''} más`;
        el.className = 'cupo-info';
    }
}

function mostrarFichas() {
    const grid = document.getElementById('gridFichas');
    if (!grid) return;
    grid.innerHTML = '';

    const equipo = datos.equipos.find(eq => eq.id === usuarioActual.equipoId);
    const cupoLleno = equipo && equipo.miembros.length >= 3;

    let mostraron = 0;
    datos.estudiantes.forEach(est => {
        if (est.id === usuarioActual.id) return;  // No mostrarse a sí mismo
        if (est.equipoId)                  return;  // Ya está en un equipo

        const div = document.createElement('div');
        div.className = 'ficha' + (cupoLleno ? ' disabled' : '');
        div.dataset.nombre = est.nombre;
        div.dataset.rol    = est.rol;
        div.innerHTML = `
            <div class="ficha-avatar">${inicialAlumno(est.nombre)}</div>
            <div class="ficha-nombre">${est.nombre}</div>
            <div class="ficha-rol">${est.rol}</div>
        `;

        if (!cupoLleno) {
            div.onclick = () => abrirModalConfirmacion(est);
        }

        grid.appendChild(div);
        mostraron++;
    });

    if (mostraron === 0) {
        grid.innerHTML = '<div class="fichas-vacio">🎉 Todos los compañeros ya están en equipos.</div>';
    }

    actualizarCupoInfo();
}

function filtrarCompaneros() {
    const filtro = document.getElementById('buscarCompanero').value;
    document.querySelectorAll('.ficha').forEach(ficha => {
        const texto = (ficha.dataset.nombre || '') + ' ' + (ficha.dataset.rol || '');
        ficha.style.display = busquedaFuzzy(filtro, texto) ? '' : 'none';
    });
}

// ─── MODAL DE CONFIRMACIÓN DE INVITACIÓN (Bug fix #2) ─────────────────────────

let _estudianteEnEspera = null;  // alumno pendiente de confirmar

/**
 * Muestra el <dialog> nativo para confirmar o cancelar la invitación.
 * Permite continuar invitando más compañeros respetando el cupo máximo de 3.
 */
function abrirModalConfirmacion(estudiante) {
    _estudianteEnEspera = estudiante;

    const equipo = datos.equipos.find(eq => eq.id === usuarioActual.equipoId);
    const actual = equipo ? equipo.miembros.length : 1;
    const libre  = 3 - actual;

    document.getElementById('modalNombreInvitado').textContent = estudiante.nombre;
    document.getElementById('modalSubtexto').textContent =
        libre === 1
            ? '⚠️ Será el último lugar disponible en tu equipo.'
            : `Te quedarán ${libre - 1} lugar${libre - 1 > 1 ? 'es' : ''} después de esto.`;

    const modal = document.getElementById('modalConfirmacion');
    modal.showModal();
}

// Confirmar desde el modal
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btnConfirmarInvitacion').addEventListener('click', function () {
        document.getElementById('modalConfirmacion').close();
        if (_estudianteEnEspera) {
            invitarAlEquipo(_estudianteEnEspera.id);
            _estudianteEnEspera = null;
        }
    });

    document.getElementById('btnCancelarInvitacion').addEventListener('click', function () {
        document.getElementById('modalConfirmacion').close();
        _estudianteEnEspera = null;
    });

    cargarDatos();
    renderizarEstadoSistema();
    renderizarListaEstudiantesProf();
});

function invitarAlEquipo(estudianteId) {
    const estudiante = datos.estudiantes.find(e => e.id === estudianteId);
    if (!estudiante) { mostrarToast('Alumno no encontrado', 'error'); return; }

    // Crear equipo si el usuario no tiene uno
    if (!usuarioActual.equipoId) {
        const nuevoEquipo = {
            id:          Date.now(),
            miembros:    [
                { id: usuarioActual.id, nombre: usuarioActual.nombre, rol: usuarioActual.rol },
                { id: estudiante.id,    nombre: estudiante.nombre,    rol: estudiante.rol }
            ],
            puntosEquipo: 0,
            pasos:        0
        };
        datos.equipos.push(nuevoEquipo);
        usuarioActual.equipoId = nuevoEquipo.id;
        estudiante.equipoId    = nuevoEquipo.id;

        // Sincronizar en array estudiantes
        const yo = datos.estudiantes.find(e => e.id === usuarioActual.id);
        if (yo) yo.equipoId = nuevoEquipo.id;

        mostrarToast(`✅ Equipo creado con ${estudiante.nombre}`, 'ok');

    } else {
        // Agregar a equipo existente
        const equipo = datos.equipos.find(eq => eq.id === usuarioActual.equipoId);
        if (!equipo) return;

        if (equipo.miembros.length >= 3) {
            mostrarToast('🔒 Tu equipo ya está completo (máx. 3 personas)', 'warn');
            return;
        }

        equipo.miembros.push({
            id:     estudiante.id,
            nombre: estudiante.nombre,
            rol:    estudiante.rol
        });
        estudiante.equipoId = equipo.id;
        mostrarToast(`✅ ${estudiante.nombre} agregado al equipo`, 'ok');
    }

    guardarDatos();
    mostrarFichas();
    actualizarMiEquipo();
    actualizarCupoInfo();
}

// ─── MI EQUIPO — VISTA ALUMNO (Bug fix #4 — módulo completo) ──────────────────

/**
 * Renderiza el panel completo de "Mi Equipo":
 * - Tarjetas de integrantes confirmados
 * - Slots vacíos clicables
 * - Sección de solicitudes enviadas (estado Pendiente/Aceptado)
 */
function actualizarMiEquipo() {
    const container = document.getElementById('miEquipoContent');
    if (!container) return;

    const equipo = datos.equipos.find(eq => eq.id === usuarioActual.equipoId);

    if (!equipo) {
        container.innerHTML = `
            <div class="equipo-vacio-msg">
                <div class="emoji-grande">🤝</div>
                <p>Aún no tienes equipo.<br>
                   Ve a la pestaña <strong>Fichas</strong> y haz clic en un compañero para invitarlo.</p>
            </div>
        `;
        return;
    }

    // Header del equipo
    let html = `
        <div class="equipo-header-info">
            <strong>Tu Equipo ⚡</strong>
            <span class="equipo-pts-badge">🏆 ${equipo.puntosEquipo || 0} pts</span>
        </div>
        <div class="equipo-miembros-grid">
    `;

    equipo.miembros.forEach(m => {
        const esYo = m.id === usuarioActual.id;
        html += `
            <div class="miembro-equipo">
                <div class="miembro-avatar">${inicialAlumno(m.nombre)}</div>
                <div class="miembro-equipo-nombre">${m.nombre}${esYo ? ' <span style="font-size:10px;opacity:.8">(tú)</span>' : ''}</div>
                <div class="miembro-equipo-rol">${m.rol}</div>
            </div>
        `;
    });

    // Slots vacíos
    const slotsLibres = 3 - equipo.miembros.length;
    for (let i = 0; i < slotsLibres; i++) {
        html += `
            <div class="slot-vacio" onclick="irAFichas()">
                ➕
                <p>Invitar compañero</p>
            </div>
        `;
    }

    html += '</div>';

    // Sección de solicitudes enviadas (simulado con lista de miembros confirmados)
    html += `
        <div class="solicitudes-seccion">
            <h3>📋 Estado de integrantes</h3>
    `;

    equipo.miembros.forEach(m => {
        html += `
            <div class="solicitud-item">
                <span>${m.nombre}</span>
                <span class="solicitud-estado aceptado">✅ Confirmado</span>
            </div>
        `;
    });

    for (let i = 0; i < slotsLibres; i++) {
        html += `
            <div class="solicitud-item">
                <span style="color:#aaa">Lugar disponible</span>
                <span class="solicitud-estado pendiente">⌛ Vacío</span>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

function irAFichas() {
    const btn = document.querySelector('#navAlumno .tab-btn');
    if (btn) btn.click();
}

// ─── RULETA ───────────────────────────────────────────────────────────────────

let _rotacionActual = 0;

function girarRuleta() {
    if (datos.actividades.length === 0) {
        mostrarToast('El profesor debe cargar actividades primero', 'warn');
        return;
    }

    const btn     = document.getElementById('btnGirar');
    const disco   = document.getElementById('ruletaDisc');
    btn.disabled  = true;

    document.getElementById('actividadActual').classList.add('hidden');
    document.getElementById('adversidadActual').classList.add('hidden');

    const giro = Math.floor(Math.random() * 360) + 1080;
    _rotacionActual += giro;
    disco.style.transition = 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
    disco.style.transform  = `rotate(${_rotacionActual}deg)`;

    setTimeout(() => {
        const idx       = Math.floor(Math.random() * (datos.actividades.length));
        const actividad = datos.actividades[idx];

        // Actividad especial: módulo secreto de pasos
        if (actividad.id === 999) {
            document.getElementById('moduloPasos').classList.remove('hidden');
            mostrarToast('👣 ¡Salió Caminata! Abre el módulo secreto.', 'info');
            btn.disabled = false;
            return;
        }

        document.getElementById('actividadNombre').textContent      = actividad.nombre;
        document.getElementById('actividadDescripcion').textContent  = actividad.descripcion;
        document.getElementById('actividadActual').classList.remove('hidden');

        if (datos.adversidades.length > 0) {
            const adv = datos.adversidades[Math.floor(Math.random() * datos.adversidades.length)];
            document.getElementById('adversidadTexto').textContent = adv.texto;
            document.getElementById('adversidadActual').classList.remove('hidden');
        }

        btn.disabled = false;
    }, 3100);
}

function aceptarActividad() {
    const equipo = datos.equipos.find(eq => eq.id === usuarioActual.equipoId);
    if (equipo) {
        equipo.puntosEquipo = (equipo.puntosEquipo || 0) + 5;
    }
    usuarioActual.puntosPersonales = (usuarioActual.puntosPersonales || 0) + 3;
    const est = datos.estudiantes.find(e => e.id === usuarioActual.id);
    if (est) est.puntosPersonales = usuarioActual.puntosPersonales;

    actualizarPuntos();
    guardarDatos();
    mostrarToast('✅ ¡Aceptado! +3 pts personales, +5 pts al equipo', 'ok');
    document.getElementById('actividadActual').classList.add('hidden');
}

function rechazarActividad() {
    mostrarToast('❌ Sin problema, ¡la próxima!', 'info');
    document.getElementById('actividadActual').classList.add('hidden');
    document.getElementById('adversidadActual').classList.add('hidden');
}

// ─── PUNTUACIÓN ───────────────────────────────────────────────────────────────

function actualizarPuntos() {
    const pts = usuarioActual.puntosPersonales || 0;
    const el  = document.getElementById('puntosHeader');
    if (el) el.textContent = `Pts: ${pts}`;
}

function registrarPuntuacionProf() {
    const equipoId = document.getElementById('selectEquipo').value;
    const personal = parseInt(document.getElementById('inputPuntosPersonal').value) || 0;
    const equipo_p = parseInt(document.getElementById('inputPuntosEquipo').value) || 0;

    if (!equipoId) { mostrarToast('Selecciona un equipo', 'warn'); return; }

    const equipo = datos.equipos.find(eq => String(eq.id) === String(equipoId));
    if (!equipo) { mostrarToast('Equipo no encontrado', 'error'); return; }

    equipo.puntosEquipo = (equipo.puntosEquipo || 0) + equipo_p;
    equipo.miembros.forEach(m => {
        const est = datos.estudiantes.find(e => e.id === m.id);
        if (est) est.puntosPersonales = (est.puntosPersonales || 0) + personal;
    });

    const registro = {
        ts:      new Date().toLocaleTimeString(),
        equipo:  equipo.miembros.map(m => m.nombre).join(', '),
        personal,
        equipo_p
    };
    datos.historialPuntuacion.unshift(registro);

    guardarDatos();
    mostrarToast('✅ Puntuación registrada', 'ok');
    renderizarHistorial();

    document.getElementById('inputPuntosPersonal').value = '';
    document.getElementById('inputPuntosEquipo').value   = '';
}

function renderizarHistorial() {
    const el = document.getElementById('historialPuntuacion');
    if (!el) return;
    if (datos.historialPuntuacion.length === 0) { el.innerHTML = ''; return; }

    el.innerHTML = '<h3 style="font-size:14px;font-weight:800;margin-bottom:12px;color:#7F8C8D">Historial reciente</h3>' +
        datos.historialPuntuacion.slice(0, 10).map(r => `
            <div class="historial-item">
                <span><strong>${r.equipo}</strong></span>
                <span>+${r.personal} personal / +${r.equipo_p} equipo — ${r.ts}</span>
            </div>
        `).join('');
}

// ─── RANKING ──────────────────────────────────────────────────────────────────

function actualizarRanking() {
    const container = document.getElementById('tablaRanking');
    if (!container) return;

    if (datos.equipos.length === 0) {
        container.innerHTML = '<p style="color:#7F8C8D;text-align:center;padding:20px">Sin equipos formados aún.</p>';
        return;
    }

    const ranking = [...datos.equipos].sort((a, b) => (b.puntosEquipo || 0) - (a.puntosEquipo || 0));
    const medallas = ['🥇', '🥈', '🥉'];

    container.innerHTML = ranking.map((eq, i) => {
        const nombres = eq.miembros.map(m => m.nombre.split(' ')[0]).join(', ');
        return `
            <div class="ranking-row">
                <div class="ranking-pos">${medallas[i] || (i + 1)}</div>
                <div class="ranking-nombre">${nombres}</div>
                <div class="ranking-pts">${eq.puntosEquipo || 0} pts</div>
            </div>
        `;
    }).join('');
}

// ─── LOGROS ───────────────────────────────────────────────────────────────────

function actualizarLogros() {
    const container = document.getElementById('logrosGrid');
    if (!container) return;

    const logros = [
        { nombre: 'Primer Paso',    emoji: '👣', desbloqueado: () => (usuarioActual.pasos || 0) > 0 },
        { nombre: 'Campeón',        emoji: '🏆', desbloqueado: () => (usuarioActual.puntosPersonales || 0) >= 30 },
        { nombre: 'Explorador',     emoji: '🔍', desbloqueado: () => !!usuarioActual.equipoId },
        { nombre: 'Equipo Perfecto',emoji: '👥', desbloqueado: () => {
            const eq = datos.equipos.find(e => e.id === usuarioActual.equipoId);
            return eq && eq.miembros.length >= 3;
        }},
        { nombre: 'Caminante',      emoji: '🚶', desbloqueado: () => (usuarioActual.pasos || 0) >= 500 },
        { nombre: 'Maratonista',    emoji: '🏃', desbloqueado: () => (usuarioActual.pasos || 0) >= 2000 }
    ];

    container.innerHTML = logros.map(l => {
        const ok = l.desbloqueado();
        return `
            <div class="logro${ok ? '' : ' bloqueado'}" title="${ok ? '¡Desbloqueado!' : 'Bloqueado'}">
                <div class="logro-emoji">${l.emoji}</div>
                <div class="logro-nombre">${l.nombre}</div>
            </div>
        `;
    }).join('');
}

// ─── RESUMEN PROFESOR ─────────────────────────────────────────────────────────

function actualizarResumenProf() {
    const el = document.getElementById('resumenGeneral');
    if (!el) return;

    const ranking = [...datos.equipos].sort((a, b) => (b.puntosEquipo || 0) - (a.puntosEquipo || 0));

    el.innerHTML = `
        <div class="resumen-stats">
            <div class="stat-card"><span class="stat-num">${datos.estudiantes.length}</span><div class="stat-label">Estudiantes</div></div>
            <div class="stat-card"><span class="stat-num">${datos.equipos.length}</span><div class="stat-label">Equipos</div></div>
            <div class="stat-card"><span class="stat-num">${datos.actividades.length}</span><div class="stat-label">Actividades</div></div>
        </div>
        <h3 style="font-size:16px;font-weight:900;margin-bottom:14px">🏆 Tabla de Equipos</h3>
        ${ranking.length === 0
            ? '<p style="color:#7F8C8D">Sin equipos.</p>'
            : ranking.map((eq, i) => {
                const nombres = eq.miembros.map(m => m.nombre).join(', ');
                return `
                    <div class="ranking-row">
                        <div class="ranking-pos">${['🥇','🥈','🥉'][i] || (i+1)}</div>
                        <div class="ranking-nombre">${nombres}</div>
                        <div class="ranking-pts">${eq.puntosEquipo || 0} pts</div>
                    </div>
                `;
            }).join('')
        }
    `;
}

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────

function cambiarTab(nombre, btnEl) {
    const panel = document.getElementById('panelAlumno');
    panel.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const map = {
        fichas:   'tabFichas',
        miEquipo: 'tabMiEquipo',
        ruleta:   'tabRuleta',
        ranking:  'tabRanking',
        logros:   'tabLogros'
    };

    const tabEl = document.getElementById(map[nombre]);
    if (tabEl) tabEl.classList.remove('hidden');
    if (btnEl) btnEl.classList.add('active');

    if (nombre === 'ranking')  actualizarRanking();
    if (nombre === 'logros')   actualizarLogros();
    if (nombre === 'miEquipo') actualizarMiEquipo();
    if (nombre === 'fichas')   mostrarFichas();
}

function cambiarTabProf(nombre, btnEl) {
    const panel = document.getElementById('panelProfesor');
    panel.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const tabId = 'tab' + nombre.charAt(0).toUpperCase() + nombre.slice(1);
    const tabEl = document.getElementById(tabId);
    if (tabEl) tabEl.classList.remove('hidden');
    if (btnEl) btnEl.classList.add('active');

    if (nombre === 'equipos')    actualizarEquiposProf();
    if (nombre === 'actividades') renderizarActividadesProf();
    if (nombre === 'resumen')    actualizarResumenProf();
    if (nombre === 'puntuacion') {
        actualizarSelectEquipos();
        renderizarHistorial();
    }
}
