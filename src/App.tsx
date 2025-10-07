import React, { useEffect, useMemo, useState } from "react";
import { Routes, Route, NavLink, Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";

/** ===== Types ===== */
type Pokemon = {
  id: number;
  name: string;
  base_experience: number;
  height: number;
  weight: number;
  types: string[];
  sprite: string;
};

/** ===== Helpers to talk to PokeAPI ===== */
const api = axios.create({ baseURL: "https://pokeapi.co/api/v2" });

async function fetchAll(limit = 151): Promise<Pokemon[]> {
  // get the first 151 Pokemon names/urls
  const { data } = await api.get(`/pokemon?limit=${limit}`);
  const results: { name: string; url: string }[] = data.results;

  // fetch details in parallel
  const detailResponses = await Promise.all(results.map((r) => axios.get(r.url)));
  return detailResponses
    .map(({ data }) => ({
      id: data.id,
      name: data.name,
      base_experience: data.base_experience,
      height: data.height,
      weight: data.weight,
      types: data.types.map((t: any) => t.type.name),
      sprite:
        data.sprites.other?.["official-artwork"]?.front_default ||
        data.sprites.front_default ||
        "",
    }))
    .sort((a: Pokemon, b: Pokemon) => a.id - b.id);
}

async function fetchOne(nameOrId: string): Promise<Pokemon> {
  const { data } = await api.get(`/pokemon/${nameOrId.toLowerCase()}`);
  return {
    id: data.id,
    name: data.name,
    base_experience: data.base_experience,
    height: data.height,
    weight: data.weight,
    types: data.types.map((t: any) => t.type.name),
    sprite:
      data.sprites.other?.["official-artwork"]?.front_default ||
      data.sprites.front_default ||
      "",
  };
}

/** ===== App (top level) ===== */
export default function App() {
  // all = full list; currentOrder = order of *whatever the user last saw* (for Detail prev/next)
  const [all, setAll] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchAll(151);
        if (mounted) setAll(data);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load Pokémon");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="App">
      <header className="app-header">
        <nav className="nav">
          <h1 className="brand">PokéDex</h1>
          <div className="links">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
              List
            </NavLink>
            <NavLink to="/gallery" className={({ isActive }) => (isActive ? "active" : "")}>
              Gallery
            </NavLink>
          </div>
        </nav>
      </header>

      <main className="container">
        {loading && <p>Loading…</p>}
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
        {!loading && !error && (
          <Routes>
            <Route
              path="/"
              element={<ListView all={all} setCurrentOrder={setCurrentOrder} />}
            />
            <Route
              path="/gallery"
              element={<GalleryView all={all} setCurrentOrder={setCurrentOrder} />}
            />
            <Route
              path="/pokemon/:name"
              element={
                <DetailView
                  all={all}
                  currentOrder={currentOrder}
                />
              }
            />
          </Routes>
        )}
      </main>

      <footer className="footer">
        <small>
          Data from <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">PokeAPI</a>.
          Built with React + TypeScript + React Router + Axios.
        </small>
      </footer>
    </div>
  );
}

/** ===== List View ===== */
function ListView({
  all,
  setCurrentOrder,
}: {
  all: Pokemon[];
  setCurrentOrder: (names: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "id" | "base_experience">("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const sorters: Record<typeof sortBy, (a: Pokemon, b: Pokemon) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    id: (a, b) => a.id - b.id,
    base_experience: (a, b) => (a.base_experience || 0) - (b.base_experience || 0),
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? all.filter((p) => p.name.includes(q) || String(p.id) === q)
      : all;
    const sorted = [...base].sort(sorters[sortBy]);
    if (dir === "desc") sorted.reverse();
    return sorted;
  }, [all, query, sortBy, dir]);

  // for Detail prev/next
  useEffect(() => {
    setCurrentOrder(filtered.map((p) => p.name));
  }, [filtered, setCurrentOrder]);

  return (
    <section>
      <div className="controls">
        <input
          className="search"
          placeholder="Search name or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label>
          Sort by:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="name">Name</option>
            <option value="id">ID</option>
            <option value="base_experience">Base XP</option>
          </select>
        </label>
        <button className="btn" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}>
          {dir === "asc" ? "Asc ⬆︎" : "Desc ⬇︎"}
        </button>
      </div>

      <ul className="list">
        {filtered.map((p) => (
          <li key={p.id} className="card">
            <Link to={`/pokemon/${p.name}`}>
              <div className="card-inner">
                <img src={p.sprite} alt={p.name} loading="lazy" />
                <div>
                  <h3>#{p.id} {cap(p.name)}</h3>
                  <p>Types: {p.types.join(", ")}</p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** ===== Gallery View ===== */
const ALL_TYPES = [
  "normal","fire","water","electric","grass","ice","fighting","poison","ground","flying",
  "psychic","bug","rock","ghost","dragon","dark","steel","fairy"
];

function GalleryView({
  all,
  setCurrentOrder,
}: {
  all: Pokemon[];
  setCurrentOrder: (names: string[]) => void;
}) {
  const [active, setActive] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (active.length === 0) return all;
    return all.filter((p) => active.every((t) => p.types.includes(t)));
  }, [all, active]);

  useEffect(() => {
    setCurrentOrder(filtered.map((p) => p.name));
  }, [filtered, setCurrentOrder]);

  return (
    <section>
      <div className="filters">
        {ALL_TYPES.map((t) => (
          <label key={t} className={`pill ${active.includes(t) ? "on" : ""}`}>
            <input
              type="checkbox"
              checked={active.includes(t)}
              onChange={() =>
                setActive((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))
              }
            />
            <span>{t}</span>
          </label>
        ))}
        {active.length > 0 && (
          <button className="clear" onClick={() => setActive([])}>
            Clear
          </button>
        )}
      </div>

      <div className="grid">
        {filtered.map((p) => (
          <Link to={`/pokemon/${p.name}`} className="tile" key={p.id}>
            <img src={p.sprite} alt={p.name} loading="lazy" />
            <div className="caption">#{p.id} {cap(p.name)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** ===== Detail View ===== */
function DetailView({
  all,
  currentOrder,
}: {
  all: Pokemon[];
  currentOrder: string[];
}) {
  const { name = "" } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // fetch details for the selected item (ensures deep links work)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const p = await fetchOne(name);
        if (mounted) setData(p);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [name]);

  const order = currentOrder.length ? currentOrder : all.map((p) => p.name);
  const index = useMemo(() => order.findIndex((n) => n === name), [order, name]);
  const prevName = index > 0 ? order[index - 1] : null;
  const nextName = index >= 0 && index < order.length - 1 ? order[index + 1] : null;

  if (loading) return <p>Loading…</p>;
  if (error || !data) return <p style={{ color: "crimson" }}>Error: {error || "Not found"}</p>;

  return (
    <article className="detail">
      <div className="media">
        <img src={data.sprite} alt={data.name} />
      </div>

      <div className="info">
        <h2>#{data.id} {cap(data.name)}</h2>
        <dl className="meta">
          <div><dt>Types</dt><dd>{data.types.join(", ")}</dd></div>
          <div><dt>Base XP</dt><dd>{data.base_experience}</dd></div>
          <div><dt>Height</dt><dd>{data.height}</dd></div>
          <div><dt>Weight</dt><dd>{data.weight}</dd></div>
        </dl>

        <div className="actions">
          <button disabled={!prevName} onClick={() => prevName && nav(`/pokemon/${prevName}`)}>← Prev</button>
          <Link to="/" className="home">Back to List</Link>
          <button disabled={!nextName} onClick={() => nextName && nav(`/pokemon/${nextName}`)}>Next →</button>
        </div>
      </div>
    </article>
  );
}

/** ===== Small util ===== */
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
