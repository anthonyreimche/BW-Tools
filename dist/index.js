//#region src/tables.ts
var e = [
	.2126,
	.7152,
	.0722
], t = [
	{
		label: "Neutral",
		weights: e
	},
	{
		label: "Panchromatic",
		weights: [
			.27,
			.53,
			.2
		]
	},
	{
		label: "Extended red",
		weights: [
			.45,
			.4,
			.15
		]
	},
	{
		label: "Orthochromatic",
		weights: [
			0,
			.55,
			.45
		]
	},
	{
		label: "Blue-sensitive",
		weights: [
			0,
			.1,
			.9
		]
	},
	{
		label: "Infrared",
		weights: [
			.55,
			.95,
			-.5
		]
	},
	{
		label: "Custom",
		weights: null
	}
], n = [
	{
		label: "None",
		transmission: [
			1,
			1,
			1
		]
	},
	{
		label: "Yellow (#8)",
		transmission: [
			1,
			.95,
			.35
		]
	},
	{
		label: "Deep yellow (#15)",
		transmission: [
			1,
			.85,
			.15
		]
	},
	{
		label: "Orange (#21)",
		transmission: [
			1,
			.6,
			.05
		]
	},
	{
		label: "Red (#25)",
		transmission: [
			1,
			.15,
			.02
		]
	},
	{
		label: "Deep red (#29)",
		transmission: [
			1,
			.05,
			.01
		]
	},
	{
		label: "Yellow-green (#11)",
		transmission: [
			.55,
			1,
			.35
		]
	},
	{
		label: "Green (#58)",
		transmission: [
			.15,
			1,
			.15
		]
	},
	{
		label: "Blue (#47)",
		transmission: [
			.05,
			.2,
			1
		]
	}
], r = [
	"Red",
	"Orange",
	"Yellow",
	"Green",
	"Aqua",
	"Blue",
	"Purple",
	"Magenta"
], i = [
	0,
	30,
	60,
	120,
	180,
	240,
	280,
	320
], a = [
	40,
	30,
	30,
	60,
	60,
	60,
	40,
	40
], o = [
	30,
	30,
	60,
	60,
	60,
	40,
	40,
	40
], s = [
	{
		label: "None",
		nodes: [
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0]
		]
	},
	{
		label: "Sepia",
		nodes: [
			[30, .1],
			[32, .45],
			[35, .6],
			[38, .4]
		]
	},
	{
		label: "Selenium",
		nodes: [
			[330, .35],
			[345, .25],
			[20, .08],
			[0, 0]
		]
	},
	{
		label: "Gold",
		nodes: [
			[220, .25],
			[215, .25],
			[210, .15],
			[200, .05]
		]
	},
	{
		label: "Cyanotype",
		nodes: [
			[205, .55],
			[205, .75],
			[200, .6],
			[195, .3]
		]
	},
	{
		label: "Platinum",
		nodes: [
			[28, .2],
			[30, .25],
			[35, .22],
			[40, .12]
		]
	},
	{
		label: "Copper",
		nodes: [
			[12, .35],
			[15, .5],
			[18, .45],
			[20, .2]
		]
	},
	{
		label: "Split (selenium + sepia)",
		nodes: [
			[260, .3],
			[240, .15],
			[35, .25],
			[38, .35]
		]
	}
], c = .25, l = .15, u = .05;
function d(e) {
	if (!Number.isFinite(e)) throw Error(`[black-and-white] not a finite number: ${e}`);
	let t = String(e === 0 ? 0 : e);
	return /[.e]/.test(t) ? t : `${t}.0`;
}
function f(e) {
	return `vec3(${e.map(d).join(", ")})`;
}
//#endregion
//#region src/params.ts
var p = "black-and-white", m = `${p}.convert`, h = `${p}.tone`, g = `${p}.panel`, _ = `${p}.target`, v = `${p}.toggle`;
function y(e, t, n, r, i, a, o = "float") {
	return {
		stage: e,
		key: t,
		type: o,
		def: n,
		min: r,
		max: i,
		label: a
	};
}
var b = y("convert", "on", 0, 0, 1, "Black & White"), x = y("tone", "on", 0, 0, 1, "Black & White"), S = r.map((e, t) => y("convert", `band${t}`, 0, -100, 100, e)), C = {
	response: y("convert", "response", 0, 0, 6, "Response", "int"),
	filterType: y("convert", "filterType", 0, 0, 8, "Filter", "int"),
	filterStrength: y("convert", "filterStrength", 100, 0, 100, "Filter strength"),
	mixR: y("convert", "mixR", 21, -200, 200, "Custom red"),
	mixG: y("convert", "mixG", 72, -200, 200, "Custom green"),
	mixB: y("convert", "mixB", 7, -200, 200, "Custom blue"),
	keepHue: y("convert", "keepHue", 0, 0, 360, "Keep hue"),
	keepRange: y("convert", "keepRange", 30, 5, 90, "Keep range"),
	keepAmount: y("convert", "keepAmount", 0, 0, 100, "Keep amount"),
	toner: y("tone", "toner", 0, 0, 7, "Toner", "int"),
	tonerStrength: y("tone", "tonerStrength", 100, 0, 100, "Toner strength"),
	hiHue: y("tone", "hiHue", 40, 0, 360, "Highlights hue"),
	hiSat: y("tone", "hiSat", 0, 0, 100, "Highlights saturation"),
	shHue: y("tone", "shHue", 220, 0, 360, "Shadows hue"),
	shSat: y("tone", "shSat", 0, 0, 100, "Shadows saturation"),
	balance: y("tone", "balance", 0, -100, 100, "Balance"),
	paperHue: y("tone", "paperHue", 40, 0, 360, "Paper hue"),
	paperSat: y("tone", "paperSat", 0, 0, 100, "Paper saturation")
}, w = Object.keys(C), T = (e) => w.map((e) => C[e]).filter((t) => t.stage === e), ee = [
	"toner",
	"hiSat",
	"shSat",
	"paperSat"
].map((e) => C[e]), te = [
	b,
	...T("convert"),
	...S,
	x,
	...T("tone")
], E = (e) => `${e.stage === "convert" ? m : h}.${e.key}`, D = {
	convertOn: E(b),
	toneOn: E(x)
};
function O(e, t) {
	if (typeof t != "number" || !Number.isFinite(t)) return e.def;
	let n = Math.min(e.max, Math.max(e.min, t));
	return e.type === "int" ? Math.round(n) : n;
}
function k(e, t) {
	return O(t, e[E(t)]);
}
function A(e) {
	return {
		...Object.fromEntries(w.map((t) => [t, k(e, C[t])])),
		on: k(e, b) > .5,
		bands: S.map((t) => k(e, t))
	};
}
var j = A({});
function M(e) {
	let t = +!!e;
	return {
		[D.convertOn]: t,
		[D.toneOn]: t
	};
}
function N(e) {
	let t = {};
	e.on !== void 0 && Object.assign(t, M(e.on)), e.bands?.forEach((e, n) => {
		t[E(S[n])] = O(S[n], e);
	});
	for (let n of w) {
		let r = e[n];
		r !== void 0 && (t[E(C[n])] = O(C[n], r));
	}
	return t;
}
function P(e, t) {
	return { [E(C[e])]: O(C[e], t) };
}
function ne() {
	return N(j);
}
function F(e) {
	return k(e, b) > .5;
}
function re(e) {
	let t = F(e);
	return t === k(e, x) > .5 ? null : { [D.toneOn]: +!!t };
}
//#endregion
//#region src/model.ts
var I = (e) => e < 0 ? 0 : e > 1 ? 1 : e;
function ie(e, t, n) {
	let r = I((n - e) / (t - e));
	return r * r * (3 - 2 * r);
}
function ae(e) {
	let t = I(e);
	return t < .0031308 ? t * 12.92 : 1.055 * t ** (1 / 2.4) - .055;
}
function oe(e) {
	return e < .04045 ? e / 12.92 : ((e + .055) / 1.055) ** 2.4;
}
var se = (e, t) => e - t * Math.floor(e / t);
function ce(e) {
	let [t, n, r] = e, i = Math.max(t, n, r) - Math.min(t, n, r);
	if (i < 1e-6) return 0;
	let a;
	return a = t >= n && t >= r ? se((n - r) / i, 6) : n >= r ? (r - t) / i + 2 : (t - n) / i + 4, a * 60;
}
function le(e) {
	let t = Math.max(e[0], e[1], e[2]);
	if (t <= 1e-6) return {
		hue: 0,
		sat: 0,
		chroma: 0
	};
	let n = [
		0,
		1,
		2
	].map((n) => ae(Math.max(e[n], 0) / t)), r = 1 - Math.min(n[0], n[1], n[2]);
	return {
		hue: ce(n),
		sat: r,
		chroma: ie(0, .5, r)
	};
}
function ue(e, t) {
	let n = se(e - i[t] + 540, 360) - 180, r = a[t], s = o[t], c;
	if (n <= 0) {
		if (n <= -r) return 0;
		c = (n + r) / r;
	} else {
		if (n >= s) return 0;
		c = 1 - n / s;
	}
	return c * c * (3 - 2 * c);
}
function de(e) {
	let r = (t[e.response] ?? t[0]).weights ?? [
		e.mixR / 100,
		e.mixG / 100,
		e.mixB / 100
	], i = (n[e.filterType] ?? n[0]).transmission, a = I(e.filterStrength / 100), o = [
		r[0] * (1 + (i[0] - 1) * a),
		r[1] * (1 + (i[1] - 1) * a),
		r[2] * (1 + (i[2] - 1) * a)
	], s = Math.max(o[0] + o[1] + o[2], u);
	return [
		o[0] / s,
		o[1] / s,
		o[2] / s
	];
}
//#endregion
//#region src/frame.ts
var L = Float64Array.from({ length: 256 }, (e, t) => oe(t / 255));
function fe(e, t) {
	let n = t * 4;
	return [
		L[e.data[n]],
		L[e.data[n + 1]],
		L[e.data[n + 2]]
	];
}
function pe(e, t, n) {
	if (!(t >= 0 && t <= 1 && n >= 0 && n <= 1)) return null;
	let { width: r, height: i } = e, a = Math.min(r - 1, Math.floor(t * r)), o = Math.min(i - 1, Math.floor(n * i)), s = 0, c = 0, l = 0, u = 0;
	for (let t = Math.max(0, o - 2); t <= Math.min(i - 1, o + 2); t++) for (let n = Math.max(0, a - 2); n <= Math.min(r - 1, a + 2); n++) {
		let i = fe(e, t * r + n);
		s += i[0], c += i[1], l += i[2], u++;
	}
	return [
		s / u,
		c / u,
		l / u
	];
}
//#endregion
//#region src/auto.ts
var R = .05, me = .02, he = 3, ge = 10;
function _e(e) {
	let t = e >>> 0;
	return () => {
		t = t + 1831565813 >>> 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function ve(e, t, n = 24301) {
	let { data: r, width: i, height: a } = e, o = i * a, s = de(t), c = new Float64Array(o), l = new Float64Array(o), u = new Float64Array(o * 8);
	for (let t = 0; t < o; t++) {
		let n = fe(e, t);
		c[t] = Math.max(s[0] * n[0] + s[1] * n[1] + s[2] * n[2], 0);
		let r = le(n);
		l[t] = r.chroma;
		for (let e = 0; e < 8; e++) u[t * 8 + e] = ue(r.hue, e);
	}
	let d = [], f = [], p = (e, t) => {
		let n = Math.hypot(r[e * 4] - r[t * 4], r[e * 4 + 1] - r[t * 4 + 1], r[e * 4 + 2] - r[t * 4 + 2]) / 255 / Math.SQRT2;
		n < .05 || (d.push(e, t), f.push(n));
	}, m = _e(n), h = Int32Array.from({ length: o }, (e, t) => t);
	for (let e = o - 1; e > 0; e--) {
		let t = Math.floor(m() * (e + 1)), n = h[e];
		h[e] = h[t], h[t] = n;
	}
	for (let e = 0; e < o; e++) p(e, h[e]);
	for (let e = 0; e < a; e += 2) for (let t = 0; t < i; t += 2) {
		let n = e * i + t;
		t + 2 < i && p(n, n + 2), e + 2 < a && p(n, n + 2 * i);
	}
	return {
		base: c,
		chroma: l,
		weights: u,
		pairs: Int32Array.from(d),
		delta: Float64Array.from(f)
	};
}
function z(e, t) {
	let n = e.base.length, r = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		let n = 0;
		for (let r = 0; r < 8; r++) n += t[r] / 100 * e.weights[i * 8 + r];
		r[i] = ae(e.base[i] * 2 ** (2 * e.chroma[i] * n));
	}
	let i = e.delta.length, a = 0;
	for (let t = 0; t < i; t++) {
		let n = r[e.pairs[2 * t]] - r[e.pairs[2 * t + 1]], i = e.delta[t], o = -((n + i) ** 2) / (R * R), s = -((n - i) ** 2) / (R * R);
		a += Math.max(o, s) + Math.log1p(Math.exp(-Math.abs(o - s)));
	}
	let o = 0;
	for (let e of t) o += (e / 100) ** 2;
	return (i > 0 ? a / i : 0) - me * o;
}
function ye(e, t) {
	let n = ve(e, t), r = [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	], i = z(n, r);
	for (let e = 0; e < he; e++) for (let e = 0; e < 8; e++) {
		let t = r[e];
		for (let a = -100; a <= 100; a += ge) {
			if (a === r[e]) continue;
			let o = r.slice();
			o[e] = a;
			let s = z(n, o);
			(s > i + 1e-12 || Math.abs(s - i) <= 1e-12 && Math.abs(a) < Math.abs(t)) && (i = s, t = a);
		}
		r[e] = t;
	}
	return r;
}
//#endregion
//#region src/runtime.ts
var B = null;
function be(e) {
	B = e;
}
function V() {
	if (!B) throw Error("[black-and-white] api() called before activate()");
	return B;
}
function H(e, t, ...n) {
	return V().react.createElement(e, t, ...n);
}
//#endregion
//#region src/sample.ts
var U = null;
function xe(e, t) {
	let { width: n, height: r } = e;
	if (n < 2 || r < 2) return null;
	let i = Math.min(1, t / Math.max(n, r)), a = Math.max(1, Math.round(n * i)), o = Math.max(1, Math.round(r * i));
	U ||= new OffscreenCanvas(a, o), U.width !== a && (U.width = a), U.height !== o && (U.height = o);
	let s = U.getContext("2d", { willReadFrequently: !0 });
	return s ? (s.drawImage(e, 0, 0, a, o), {
		data: s.getImageData(0, 0, a, o).data,
		width: a,
		height: o
	}) : null;
}
function Se(e) {
	return {
		...e,
		[D.convertOn]: 0,
		[D.toneOn]: 0
	};
}
function Ce() {
	let e = V();
	return {
		develop: () => e.stores.useDevelopStore.getState(),
		render: (t, n, r) => e.develop.renderPhotoFrame(t, n, r),
		readback: xe
	};
}
async function we(e, t = Ce()) {
	let n = t.develop();
	if (!n.photoId) return null;
	let r = await t.render(n.photoId, n.previewParams ?? n.params, Se(n.paramBag));
	if (!r) return null;
	try {
		return t.readback(r, e);
	} finally {
		r.close();
	}
}
//#endregion
//#region src/actions.ts
var W = "Black & White", G = "Colour";
function Te(e, t) {
	return e === "develop" || new URLSearchParams(t).get("detached") === "develop";
}
function Ee() {
	return Te(V().stores.useUIStore.getState().activeModule, globalThis.location?.search ?? "");
}
function De() {
	return {
		develop: V().stores.useDevelopStore,
		inDevelop: Ee
	};
}
function Oe(e = De()) {
	if (!e.inDevelop()) return;
	let t = e.develop.getState();
	if (!t.photoId) return;
	let n = !F(t.paramBag);
	t.setDynParams(M(n)), t.commitEdit(n ? W : G);
}
function ke() {
	let e = V(), t = e.stores.useCatalogStore;
	return {
		develop: e.stores.useDevelopStore,
		asShot: (e) => t.getState().photos.find((t) => t.id === e)?.exif.colorTemperature,
		restoreId: t.getState().activePhotoId ?? e.stores.useDevelopStore.getState().photoId,
		inDevelop: Ee,
		warn: (e) => console.warn(e),
		yieldToUi: () => new Promise((e) => setTimeout(e, 0))
	};
}
var K = !1;
async function Ae(e, t, n) {
	let r = [], i = [];
	if (K) return n.warn("[black-and-white] A conversion is already running."), {
		converted: r,
		failed: i
	};
	K = !0;
	try {
		let a = n.develop.getState().photoId, o = !0, s = n.inDevelop();
		try {
			for (let c of e) {
				if (!s && n.inDevelop()) break;
				if (n.develop.getState().photoId !== a) {
					o = !1;
					break;
				}
				try {
					await n.develop.getState().loadEdit(c, n.asShot(c));
					let e = n.develop.getState();
					if (e.photoId !== c) {
						o = !1;
						break;
					}
					a = c, F(e.paramBag) !== t && (e.setDynParams(M(t)), await e.commitEdit(t ? W : G), r.push(c));
				} catch {
					i.push(c);
				}
				await n.yieldToUi();
			}
		} finally {
			if (o && n.restoreId && n.develop.getState().photoId === a) try {
				await n.develop.getState().loadEdit(n.restoreId, n.asShot(n.restoreId));
			} catch {
				i.includes(n.restoreId) || i.push(n.restoreId);
			}
		}
	} finally {
		K = !1;
	}
	return i.length > 0 && n.warn(`[black-and-white] ${i.length} photo(s) could not be converted: ${i.join(", ")}`), {
		converted: r,
		failed: i
	};
}
var q = (e) => (t) => t.length > 1 ? `${e} (${t.length})` : e;
function je() {
	return {
		develop: V().stores.useDevelopStore,
		render: () => we(64)
	};
}
async function Me(e = je()) {
	let t = e.develop.getState().photoId;
	if (!t) return !1;
	let n;
	try {
		n = await e.render();
	} catch {
		return !1;
	}
	if (!n) return !1;
	let r = e.develop.getState();
	return r.photoId === t && (r.setDynParams(N({ bands: ye(n, A(r.paramBag)) })), await r.commitEdit("Black & White Auto"), !0);
}
//#endregion
//#region src/store.ts
function Ne(e, t) {
	return e && t !== null && e.photoId === t ? e.sample : null;
}
var J = null;
function Pe() {
	J = V().stores.create((e) => ({
		target: !1,
		frame: null,
		auto: "idle",
		setTarget: (t) => e(t ? { target: t } : {
			target: t,
			frame: null
		}),
		setFrame: (t) => e({ frame: t }),
		setAuto: (t) => e({ auto: t })
	}));
}
function Y() {
	if (!J) throw Error("[black-and-white] store() called before activate()");
	return J;
}
//#endregion
//#region src/Panel.ts
var Fe = { padding: "6px 8px 8px" }, Ie = {
	margin: 0,
	fontSize: 10,
	lineHeight: 1.4,
	color: "var(--color-text-muted)"
}, Le = {
	fontSize: 11,
	color: "var(--color-text-secondary)",
	whiteSpace: "nowrap"
}, Re = {
	flex: "1 1 auto",
	minWidth: 0
}, ze = 2e3, X = "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";
function Be(e) {
	return e ? `Press ${e} or choose Black & White.` : "Choose Black & White to convert this photo.";
}
function Ve(e) {
	let [t, n, r] = de(e);
	return `Normalised: R ${t.toFixed(2)} · G ${n.toFixed(2)} · B ${r.toFixed(2)}`;
}
async function He(e = Me) {
	Y().getState().setAuto("busy");
	let t = !1;
	try {
		t = await e();
	} catch (e) {
		console.warn("[black-and-white] Auto failed:", e);
	} finally {
		Y().getState().setAuto(t ? "idle" : "failed");
	}
	t || setTimeout(() => {
		Y().getState().auto === "failed" && Y().getState().setAuto("idle");
	}, ze);
}
function Ue() {
	let { Slider: e } = V().components, { Button: i, Select: a, SegmentedControl: o, Section: c, Row: l, Stack: u } = V().ui, d = V().stores.useDevelopStore, f = d((e) => e.paramBag), p = d((e) => e.photoId), m = Y()((e) => e.target), h = Y()((e) => e.auto), g = A(f), _ = (e) => d.getState().setDynParams(e), y = (e) => void d.getState().commitEdit(`Black & White ${e}`), b = (t, n, r, i, a) => H(e, {
		key: n,
		label: t,
		value: g[n],
		min: r,
		max: i,
		step: 1,
		defaultValue: j[n],
		trackBackground: a,
		onChange: (e) => _(P(n, e)),
		onCommit: () => y(t.toLowerCase())
	}), x = (t, n) => H(e, {
		key: `band${n}`,
		label: t,
		value: g.bands[n],
		min: -100,
		max: 100,
		step: 1,
		defaultValue: 0,
		onChange: (e) => {
			let t = [...A(d.getState().paramBag).bands];
			t[n] = e, _(N({ bands: t }));
		},
		onCommit: () => y(`${t.toLowerCase()} mix`)
	}), S = (e, t, n) => H(l, {
		key: t,
		gap: 6
	}, H("span", { style: Le }, e), H("div", { style: Re }, H(a, {
		value: String(g[t]),
		ariaLabel: e,
		options: n.map((e, t) => ({
			value: String(t),
			label: e.label
		})),
		onChange: (n) => {
			_(P(t, Number(n))), y(e.toLowerCase());
		}
	}))), C = (e) => {
		e !== A(d.getState().paramBag).on && (_(M(e)), d.getState().commitEdit(e ? W : G));
	}, w = H(o, {
		key: "treatment",
		value: g.on ? "bw" : "colour",
		size: "sm",
		options: [{
			value: "colour",
			label: "Colour"
		}, {
			value: "bw",
			label: "Black & White"
		}],
		onChange: (e) => C(e === "bw")
	});
	if (!g.on) return H(u, {
		gap: 6,
		style: Fe
	}, w, H("p", {
		key: "hint",
		style: Ie
	}, Be(V().keybindings.getBinding(v))));
	let T = g.response === 6, ee = H(l, { gap: 4 }, H(i, {
		size: "sm",
		disabled: !p || h === "busy",
		title: "Set the eight colours so the photo's colour contrast survives in grey",
		onClick: () => void He()
	}, h === "failed" ? "Couldn't read the photo" : "Auto"), H(i, {
		size: "sm",
		active: m,
		disabled: !p,
		title: "Drag up or down over a colour in the photo to lighten or darken it (Esc ends)",
		onClick: () => Y().getState().setTarget(!m)
	}, "Target"));
	return H(u, {
		gap: 8,
		style: Fe
	}, w, H(c, {
		key: "conversion",
		title: "Conversion"
	}, H(u, { gap: 4 }, S("Response", "response", t), T ? b("Red", "mixR", -200, 200) : null, T ? b("Green", "mixG", -200, 200) : null, T ? b("Blue", "mixB", -200, 200) : null, T ? H("p", {
		key: "weights",
		style: Ie
	}, Ve(g)) : null, S("Filter", "filterType", n), g.filterType === 0 ? null : b("Strength", "filterStrength", 0, 100))), H(c, {
		key: "mix",
		title: "Mix",
		right: ee
	}, H(u, { gap: 1 }, ...r.map((e, t) => x(e, t)))), H(c, {
		key: "keep",
		title: "Selective colour"
	}, H(u, { gap: 1 }, b("Hue", "keepHue", 0, 360, X), b("Range", "keepRange", 5, 90), b("Amount", "keepAmount", 0, 100))), H(c, {
		key: "toning",
		title: "Toning"
	}, H(u, { gap: 4 }, S("Toner", "toner", s), g.toner === 0 ? null : b("Strength", "tonerStrength", 0, 100), b("Highlights hue", "hiHue", 0, 360, X), b("Highlights saturation", "hiSat", 0, 100), b("Shadows hue", "shHue", 0, 360, X), b("Shadows saturation", "shSat", 0, 100), b("Balance", "balance", -100, 100), b("Paper hue", "paperHue", 0, 360, X), b("Paper saturation", "paperSat", 0, 100))));
}
//#endregion
//#region src/glsl.ts
var Z = (e) => e.map(d).join(", "), We = "float bwHue(vec3 e) {\n  float mx = max(e.r, max(e.g, e.b));\n  float d = mx - min(e.r, min(e.g, e.b));\n  if (d < 1e-6) return 0.0;\n  float h;\n  if (e.r >= e.g && e.r >= e.b) h = mod((e.g - e.b) / d, 6.0);\n  else if (e.g >= e.b) h = (e.b - e.r) / d + 2.0;\n  else h = (e.r - e.g) / d + 4.0;\n  return h * 60.0;\n}", Ge = "vec2 bwHueChroma(vec3 rgb) {\n  float m = max(rgb.r, max(rgb.g, rgb.b));\n  if (m <= 1e-6) return vec2(0.0);\n  vec3 e = linearToSrgb(max(rgb, vec3(0.0)) / m);\n  float sat = 1.0 - min(e.r, min(e.g, e.b));\n  return vec2(bwHue(e), smoothstep(0.0, 0.5, sat));\n}", Ke = "float bwBandWeight(float hue, float centre, float dPrev, float dNext) {\n  float d = mod(hue - centre + 540.0, 360.0) - 180.0;\n  float t;\n  if (d <= 0.0) {\n    if (d <= -dPrev) return 0.0;\n    t = (d + dPrev) / dPrev;\n  } else {\n    if (d >= dNext) return 0.0;\n    t = 1.0 - d / dNext;\n  }\n  return t * t * (3.0 - 2.0 * t);\n}", qe = `float bwMixAmount(float hue, vec4 lo, vec4 hi) {
  const float CENTRE[8] = float[8](${Z(i)});
  const float PREV[8] = float[8](${Z(a)});
  const float NEXT[8] = float[8](${Z(o)});
  float a = 0.0;
  for (int i = 0; i < 8; i++) {
    float amount = i < 4 ? lo[i] : hi[i - 4];
    a += (amount / 100.0) * bwBandWeight(hue, CENTRE[i], PREV[i], NEXT[i]);
  }
  return a;
}`, Je = "float bwHueWindow(float hue, float centre, float halfWidth) {\n  float d = abs(mod(hue - centre + 540.0, 360.0) - 180.0);\n  if (d >= halfWidth) return 0.0;\n  float t = 1.0 - d / halfWidth;\n  return t * t * (3.0 - 2.0 * t);\n}";
function Ye() {
	return `vec3 bwResponse(int id, vec3 custom) {
${t.flatMap((e, t) => e.weights ? [`  if (id == ${t}) return ${f(e.weights)};`] : []).join("\n")}
  if (id == 6) return custom;
  return ${f(e)};
}`;
}
function Xe() {
	return `vec3 bwFilter(int id) {
${n.slice(1).map((e, t) => `  if (id == ${t + 1}) return ${f(e.transmission)};`).join("\n")}
  return vec3(1.0);
}`;
}
var Ze = `vec3 bwWeights(int responseId, vec3 custom, int filterId, float strength) {
  float s = clamp(strength / 100.0, 0.0, 1.0);
  vec3 v = bwResponse(responseId, custom) * (vec3(1.0) + (bwFilter(filterId) - vec3(1.0)) * s);
  return v / max(v.r + v.g + v.b, ${d(u)});
}`, Qe = [
	We,
	Ge,
	Ke,
	qe,
	Je,
	Ye(),
	Xe(),
	Ze
].join("\n\n"), $e = `if (on > 0.5) {
  vec3 bwW = bwWeights(response, vec3(mixR, mixG, mixB) / 100.0, filterType, filterStrength);
  vec2 bwHc = bwHueChroma(lin);
  float bwY = max(dot(bwW, lin), 0.0);
  bwY *= exp2(${d(2)} * bwHc.y * bwMixAmount(bwHc.x, vec4(band0, band1, band2, band3), vec4(band4, band5, band6, band7)));
  float bwKeep = clamp(keepAmount / 100.0, 0.0, 1.0) * bwHueWindow(bwHc.x, keepHue, keepRange) * bwHc.y;
  float bwL = luma(lin);
  vec3 bwColoured = bwL > 1e-6 ? lin * (bwY / bwL) : vec3(bwY);
  lin = vec3(bwY) * (1.0 - bwKeep) + bwColoured * bwKeep;
}`, et = "vec3 bwHueRgb(float hue) {\n  return clamp(abs(mod(hue / 60.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);\n}", tt = "vec3 bwTintDir(float hue) {\n  vec3 h = bwHueRgb(hue);\n  vec3 d = h - vec3(luma(h));\n  return d / max(abs(d.r), max(abs(d.g), abs(d.b)));\n}";
function nt() {
	return `vec2 bwTonerNode(int id, int k) {
${s.slice(1).map((e, t) => {
		let [n, r, i, a] = e.nodes.map(([e, t]) => `vec2(${d(e)}, ${d(t)})`);
		return `  if (id == ${t + 1}) { if (k == 0) return ${n}; if (k == 1) return ${r}; if (k == 2) return ${i}; return ${a}; }`;
	}).join("\n")}
  return vec2(0.0);
}`;
}
var rt = `vec3 bwRecipeTint(int id, float lum) {
  float x = clamp(lum, 0.0, 1.0) * 3.0;
  int k = int(min(floor(x), 2.0));
  float f = x - float(k);
  vec2 a = bwTonerNode(id, k);
  vec2 b = bwTonerNode(id, k + 1);
  vec3 ta = bwTintDir(a.x) * (a.y * ${d(c)});
  vec3 tb = bwTintDir(b.x) * (b.y * ${d(c)});
  return ta * (1.0 - f) + tb * f;
}`, it = [
	et,
	tt,
	nt(),
	rt,
	"float bwGamutAlpha(vec3 base, vec3 tint) {\n  float a = 1.0;\n  for (int i = 0; i < 3; i++) {\n    if (tint[i] > 0.0) a = min(a, (1.0 - base[i]) / tint[i]);\n    else if (tint[i] < 0.0) a = min(a, base[i] / -tint[i]);\n  }\n  return max(a, 0.0);\n}"
].join("\n\n"), at = `if (on > 0.5 && (${ee.map((e) => `${e.key} != ${e.type === "int" ? "0" : d(0)}`).join(" || ")})) {
  c = clamp(c, 0.0, 1.0);
  float bwL = luma(c);
  float bwPivot = 0.5 + (0.4 * balance) / 100.0;
  float bwHigh = smoothstep(bwPivot - 0.3, bwPivot + 0.3, bwL);
  vec3 bwShadows = bwTintDir(shHue) * ((1.0 - bwHigh) * (shSat / 100.0) * ${d(c)});
  vec3 bwHighs = bwTintDir(hiHue) * (bwHigh * (hiSat / 100.0) * ${d(c)});
  vec3 bwT = bwRecipeTint(toner, bwL) * clamp(tonerStrength / 100.0, 0.0, 1.0) + bwShadows + bwHighs;
  c = clamp(c + bwGamutAlpha(c, bwT) * bwT, 0.0, 1.0);
  if (paperSat > 0.0) {
    vec3 bwPaper = vec3(1.0) - ((paperSat / 100.0) * ${d(l)}) * (vec3(1.0) - bwHueRgb(paperHue));
    float bwW = clamp(bwL, 0.0, 1.0);
    c = c * (vec3(1.0 - bwW) + bwPaper * bwW);
  }
}`;
//#endregion
//#region src/stages.ts
function ot(e) {
	return te.filter((t) => t.stage === e).map((e) => ({
		key: e.key,
		glslType: e.type,
		default: e.def,
		range: {
			min: e.min,
			max: e.max,
			step: 1
		},
		label: e.label
	}));
}
function st() {
	return {
		id: m,
		name: "Black & White",
		phase: "scene-linear",
		priority: 900,
		glsl: $e,
		helpers: Qe,
		uniforms: ot("convert"),
		presetScope: "global"
	};
}
function ct() {
	return {
		id: h,
		name: "Black & White toning",
		phase: "display-adjust",
		priority: 100,
		glsl: at,
		helpers: it,
		uniforms: ot("tone"),
		presetScope: "global",
		space: { encoding: "perceptual" }
	};
}
function lt() {
	return [st(), ct()];
}
//#endregion
//#region src/target.ts
var ut = .5;
function dt(e, t, n, r, i) {
	if (!i || n.width <= 0 || n.height <= 0 || i.w <= 0 || i.h <= 0) return null;
	let a = r / n.width, o = ((e - n.left) * a - i.x) / i.w, s = ((t - n.top) * a - i.y) / i.h;
	return o < 0 || o > 1 || s < 0 || s > 1 ? null : {
		x: o,
		y: s
	};
}
function ft(e, t) {
	if (!e || !t) return null;
	let n = pe(e, t.x, t.y);
	return n ? le(n) : null;
}
function pt(e, t, n) {
	return t.chroma < .05 ? [...e] : e.map((e, r) => Math.max(-100, Math.min(100, e - n * ut * ue(t.hue, r) * t.chroma)));
}
var mt = "Black & White target";
function Q(e, t) {
	let n = e.current;
	n && (e.current = null, n.moved && t(mt));
}
function ht(e, t, n, r) {
	let i = e.current;
	return i ? t === 0 ? (Q(e, r.commit), !0) : n === null || (i.moved = !0, r.write(pt(i.start, i.at, n - i.y)), !0) : !1;
}
function gt(e) {
	return JSON.stringify(Object.keys(e).filter((e) => !e.startsWith(`${p}.`)).sort().map((t) => [t, e[t]]));
}
function _t() {
	let { useEffect: e, useRef: t, useState: n } = V().react, r = V().stores.useDevelopStore, i = r((e) => e.photoId), a = r((e) => e.params), o = r((e) => e.paramBag), s = Y()((e) => e.target), c = V().develop.useDevelopOverlay(), l = t(null), u = t(null), [d, f] = n(!1), [p, m] = n(!1), h = F(o), g = gt(o), _ = (e) => void r.getState().commitEdit(e);
	if (e(() => {
		s && !h && Y().getState().setTarget(!1);
	}, [s, h]), e(() => () => Y().getState().setTarget(!1), []), e(() => {
		if (!s) return;
		let e = !1, t = window.setTimeout(() => {
			we(256).then((t) => {
				e || Y().getState().setFrame(t && i ? {
					photoId: i,
					sample: t
				} : null);
			}).catch(() => {
				e || Y().getState().setFrame(null);
			});
		}, 150);
		return () => {
			e = !0, window.clearTimeout(t);
		};
	}, [
		s,
		i,
		a,
		g
	]), e(() => {
		if (s) return () => Q(u, _);
	}, [s]), e(() => {
		if (!s) return;
		let e = /* @__PURE__ */ new Set(), t = () => f(e.has("Control") || e.has("Meta") || e.has(" ")), n = (n) => {
			if (n.key === "Escape") {
				Y().getState().setTarget(!1);
				return;
			}
			e.add(n.key), t();
		}, r = (n) => {
			e.delete(n.key), t();
		}, i = () => {
			e.clear(), t();
		};
		return window.addEventListener("keydown", n), window.addEventListener("keyup", r), window.addEventListener("blur", i), () => {
			window.removeEventListener("keydown", n), window.removeEventListener("keyup", r), window.removeEventListener("blur", i), f(!1);
		};
	}, [s]), !s) return null;
	let v = () => Ne(Y().getState().frame, r.getState().photoId), y = (e, t) => {
		let n = l.current;
		if (!n) return null;
		let r = n.getBoundingClientRect(), i = r.width > 0 ? n.clientWidth / r.width : 1, a = c.imageRect ?? c.rect;
		return {
			y: (t - r.top) * i,
			uv: dt(e, t, r, n.clientWidth, a)
		};
	}, b = (e) => {
		if (e.button !== 0) return;
		let t = y(e.clientX, e.clientY), n = t ? ft(v(), t.uv) : null;
		!t || !n || n.chroma < .05 || (e.preventDefault(), e.currentTarget.setPointerCapture(e.pointerId), u.current = {
			start: [...A(r.getState().paramBag).bands],
			at: n,
			y: t.y,
			pointerId: e.pointerId,
			moved: !1
		});
	}, x = (e) => {
		let t = y(e.clientX, e.clientY);
		if (ht(u, e.buttons, t ? t.y : null, {
			write: (e) => r.getState().setDynParams(N({ bands: e })),
			commit: _
		})) return;
		let n = t ? ft(v(), t.uv) : null;
		m(n !== null && n.chroma < .05);
	}, S = (e) => {
		let t = u.current;
		t && (e.currentTarget.hasPointerCapture(t.pointerId) && e.currentTarget.releasePointerCapture(t.pointerId), Q(u, _));
	};
	return H("div", {
		ref: l,
		style: {
			position: "absolute",
			inset: 0,
			pointerEvents: d ? "none" : "auto",
			cursor: V().cursors.resolve(p ? "not-allowed" : "pick")
		},
		onPointerDown: b,
		onPointerMove: x,
		onPointerUp: S,
		onPointerCancel: S
	});
}
//#endregion
//#region src/index.ts
var $ = null;
function vt() {
	let e = V().stores.useDevelopStore.getState();
	e.setDynParams(ne()), e.commitEdit("Black & White reset");
}
function yt(e) {
	be(e), Pe();
	for (let t of lt()) e.registerProcessingStage(t);
	e.registerPanel({
		id: g,
		title: "Black & White",
		component: Ue,
		defaultDock: {
			module: "develop",
			direction: "right",
			order: 12,
			width: 280
		},
		onReset: vt
	}), e.registerSlot({
		id: _,
		slot: "develop-canvas-overlay",
		component: _t,
		order: 60
	}), e.registerKeybinding({
		id: v,
		label: "Toggle Black & White",
		category: "Develop",
		defaultCombo: "V",
		handler: () => Oe()
	}), e.registerGridMenuItem({
		id: `${p}.to-bw`,
		label: q("Convert to Black & White"),
		onClick: (e) => void Ae(e, !0, ke())
	}), e.registerGridMenuItem({
		id: `${p}.to-colour`,
		label: q("Convert to Colour"),
		onClick: (e) => void Ae(e, !1, ke())
	}), $ = e.stores.useDevelopStore.subscribe((e, t) => {
		if (e.paramBag === t.paramBag) return;
		let n = re(e.paramBag);
		n && e.setDynParams(n);
	});
}
function bt() {
	$?.(), $ = null;
	try {
		Y().getState().setTarget(!1);
		let e = V();
		for (let t of lt()) e.unregisterProcessingStage(t.id);
		e.unregisterSlot(_);
	} catch {}
}
//#endregion
export { yt as activate, bt as deactivate };

//# sourceMappingURL=index.js.map