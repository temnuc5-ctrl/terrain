import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { configurationManquante } from './api/client';
import PageAccueil from './pages/Accueil';
import PageSecteur from './pages/Secteur';
import PageIdentification from './pages/Identification';
import PageVerification from './pages/Verification';

function ConfigurationIncomplete({ manquantes }: { manquantes: string[] }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-10">
      <p className="etiquette text-[9px] text-argile">Configuration requise</p>
      <h1 className="display mt-2 text-[2rem] leading-tight text-pin">Le site n'est pas encore relié à Supabase</h1>
      <p className="mt-3 text-[13px] leading-6 text-acier">
        Les variables d'environnement suivantes manquent au moment du build :
      </p>
      <ul className="mt-4 space-y-2">
        {manquantes.map((nom) => (
          <li key={nom} className="mono border border-argile/30 bg-argile/[0.06] px-3 py-2 text-[12px] text-argile">
            {nom}
          </li>
        ))}
      </ul>
      <div className="carte mt-6 p-4 text-[12px] leading-6 text-acier">
        <p className="font-medium text-pin">Netlify → Site settings → Environment variables</p>
        <p className="mt-2">
          Ajoutez <span className="mono">VITE_SUPABASE_URL</span> et{' '}
          <span className="mono">VITE_SUPABASE_ANON_KEY</span>, puis relancez un déploiement
          (<em>Deploys → Trigger deploy → Clear cache and deploy site</em>).
        </p>
        <p className="mt-2">Les variables Vite sont lues au moment du build, pas à l'exécution.</p>
      </div>
    </main>
  );
}

function Introuvable() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <p className="etiquette text-[9px] text-acier">Contrôle terrain</p>
      <h1 className="display mt-2 text-[2rem] text-pin">Page introuvable</h1>
      <Link
        to="/rapport/accueil"
        className="mt-4 inline-flex min-h-11 items-center border border-sable px-4 text-[12px] font-medium text-pin"
      >
        Revenir au choix du secteur
      </Link>
    </main>
  );
}

export default function App() {
  const manquantes = configurationManquante();
  if (manquantes.length) return <ConfigurationIncomplete manquantes={manquantes} />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/rapport/accueil" replace />} />
      <Route path="/rapport/accueil" element={<PageAccueil />} />
      <Route path="/rapport/secteur" element={<PageSecteur />} />
      <Route path="/rapport/identification" element={<PageIdentification />} />
      <Route path="/rapport/verification" element={<PageVerification />} />
      <Route path="*" element={<Introuvable />} />
    </Routes>
  );
}
