require('dotenv').config();
const path = require('path');
const express = require('express');
const { aplicarEsquema } = require('../db/cliente');
const repo = require('../db/repositorio');
const { buscarSimbolo } = require('./tvFetcher');
const { ejecutarCiclo } = require('./cicloMonitor');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..', 'web')));

// ---------- Panel: lista de alertas activas (<36h), mas nuevas primero ----------
app.get('/api/panel', async (req, res) => {
  try {
    const alertas = await repo.listarAlertasActivas({ timeframe: req.query.timeframe });
    const timeframes = await repo.obtenerTimeframesConfig();
    const mostrarRsi = (await repo.obtenerConfigGeneral('mostrar_rsi', 'true')) === 'true';
    res.json({ alertas, timeframes, mostrarRsi });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Borrar una alerta manualmente (independiente del borrado por antiguedad) ----------
app.delete('/api/alertas/:id', async (req, res) => {
  try {
    const borrada = await repo.eliminarAlerta(req.params.id);
    res.json({ ok: true, borrada });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Historico de alertas (paginado) ----------
app.get('/api/historico', async (req, res) => {
  try {
    const limite = Math.min(Number(req.query.limite) || 50, 500);
    const offset = Number(req.query.offset) || 0;
    const historico = await repo.listarHistorico({ limite, offset });
    res.json({ historico });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Config: timeframes visibles / RSI on-off ----------
app.get('/api/config', async (req, res) => {
  const timeframes = await repo.obtenerTimeframesConfig();
  const mostrarRsi = (await repo.obtenerConfigGeneral('mostrar_rsi', 'true')) === 'true';
  res.json({ timeframes, mostrarRsi });
});

app.post('/api/config/timeframe/:tf', async (req, res) => {
  try {
    const { mostrar_en_panel: mostrarEnPanel, vigilar_cruces: vigilarCruces } = req.body;
    const campos = {};
    if (mostrarEnPanel !== undefined) campos.mostrar_en_panel = mostrarEnPanel ? 1 : 0;
    if (vigilarCruces !== undefined) campos.vigilar_cruces = vigilarCruces ? 1 : 0;
    await repo.actualizarTimeframeConfig(req.params.tf, campos);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/rsi', async (req, res) => {
  await repo.fijarConfigGeneral('mostrar_rsi', req.body.activo ? 'true' : 'false');
  res.json({ ok: true });
});

// ---------- Universo de activos: listar / crear / autocompletar desde TradingView ----------
app.get('/api/universo', async (req, res) => {
  const activos = await repo.listarTodosLosActivos();
  res.json({ activos });
});

app.get('/api/universo/buscar', async (req, res) => {
  try {
    const resultados = await buscarSimbolo(req.query.q || '', req.query.tipo || '');
    res.json({ resultados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/universo', async (req, res) => {
  try {
    const id = await repo.crearActivo(req.body);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/universo/:id/estado', async (req, res) => {
  await repo.actualizarActivo(req.params.id, { estado: req.body.estado });
  res.json({ ok: true });
});

// ---------- Medias moviles configuradas (posiciones 1-4; 1 y 2 alimentan la tendencia del panel) ----------
app.get('/api/medias', async (req, res) => {
  try {
    const medias = await repo.obtenerMediasConfig();
    res.json({ medias });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/medias', async (req, res) => {
  try {
    const { posicion, tipo, periodo } = req.body;
    if (![1, 2, 3, 4].includes(Number(posicion)) || !tipo || !periodo) {
      return res.status(400).json({ error: 'posicion (1-4), tipo y periodo son obligatorios' });
    }
    await repo.guardarMediaConfig({ posicion: Number(posicion), tipo, periodo: Number(periodo) });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Niveles de importancia (que cruces de medias se vigilan y con que nivel) ----------
app.get('/api/niveles', async (req, res) => {
  try {
    const niveles = await repo.listarNivelesImportancia();
    res.json({ niveles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/niveles', async (req, res) => {
  try {
    const {
      mediaRapida, mediaLenta, timeframe, nivel, descripcion,
    } = req.body;
    if (!mediaRapida || !mediaLenta || !timeframe || !nivel) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: mediaRapida, mediaLenta, timeframe, nivel' });
    }
    await repo.guardarNivelImportancia({
      mediaRapida, mediaLenta, timeframe, nivel, descripcion,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/niveles/:id', async (req, res) => {
  try {
    const borrada = await repo.eliminarNivelImportancia(req.params.id);
    res.json({ ok: true, borrada });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Lanzar un ciclo manualmente (util para probar / boton "Actualizar ahora") ----------
app.post('/api/ciclo/ejecutar', async (req, res) => {
  try {
    await ejecutarCiclo();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PUERTO = process.env.PORT || 3000;

aplicarEsquema().then(() => {
  app.listen(PUERTO, () => {
    console.log(`Panel disponible en http://localhost:${PUERTO}`);
  });
});
