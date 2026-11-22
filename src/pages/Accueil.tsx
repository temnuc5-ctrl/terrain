import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRapport } from "../context/RapportContext";
import { BoutonPrincipal, Entete, Note } from "../components/Chrome";
import type { Localisation } from "../types";

const formaterPosition = (localisation: Localisation) =>
  `${localisation.latitude.toFixed(5)}, ${localisation.longitude.toFixed(5)}`;

const formaterHeure = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(new Date(iso));

export default function PageAccueil() {
  const navigate = useNavigate();
  const { etat, maj } = useRapport();
  const [gpsEnCours, setGpsEnCours] = useState(false);
  const [gpsErreur, setGpsErreur] = useState("");

  const choisirEtat = (valeur: boolean) => maj({ operationnelle: valeur });

  const recupererPosition = () => {
    if (!("geolocation" in navigator)) {
      setGpsErreur("Cet appareil ne propose pas la géolocalisation.");
      return;
    }
    setGpsEnCours(true);
    setGpsErreur("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        maj({
          localisation: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            precision: position.coords.accuracy,
            horodatage: new Date(position.timestamp).toISOString(),
          },
        });
        setGpsEnCours(false);
      },
      (erreur) => {
        setGpsEnCours(false);
        setGpsErreur(
          erreur.code === 1
            ? "Localisation refusée. Autorisez la position dans les réglages du navigateur."
            : erreur.code === 2
              ? "Position indisponible. Sortez à l'air libre et réessayez."
              : "Délai dépassé. Réessayez dans quelques instants.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  return (
    <div className="min-h-screen pb-12">
      <Entete etape={1} />

      <main className="mx-auto w-full max-w-xl px-5">
        {/* Marque */}
        <section className="monter flex flex-col items-center pt-9 text-center">
          <div className="relative grid h-24 w-24 place-items-center border border-pin/25 bg-[#fdfcf6]">
            <span className="h-10 w-10 rotate-45 bg-pin" aria-hidden="true" />
            <span className="absolute -bottom-px -right-px h-3.5 w-3.5 bg-citron-fonce" aria-hidden="true" />
            <span className="absolute left-2 top-2 h-1.5 w-1.5 bg-pin/25" aria-hidden="true" />
          </div>
          <p className="mt-5 etiquette text-[9px] text-acier">Contrôle terrain</p>
          <h1 className="display mt-2 text-[2.45rem] leading-none text-pin">Douches de sécurité</h1>
          <p className="mt-3 max-w-[19rem] text-[12px] leading-6 text-acier">
            Relevez l'état de l'installation, puis contrôlez chaque douche. Vos réponses sont transmises à la
            supervision.
          </p>
        </section>

        {/* État de l'installation */}
        <section className="monter d1 mt-8">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="display text-[1.15rem] text-pin">Installation opérationnelle ?</h2>
              <p className="mt-1 text-[11px] text-acier">État général constaté à l'arrivée sur site.</p>
            </div>
            <span className="etiquette text-[7px] text-acier">obligatoire</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { valeur: true, titre: "Oui", detail: "En service", actif: "border-pin bg-pin text-white" },
              { valeur: false, titre: "Non", detail: "Hors service", actif: "border-argile bg-argile text-white" },
            ].map((option) => {
              const actif = etat.operationnelle === option.valeur;
              return (
                <button
                  key={option.titre}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => choisirEtat(option.valeur)}
                  className={`relative flex min-h-[92px] flex-col items-start justify-between border px-4 py-3.5 text-left transition ${
                    actif
                      ? `${option.actif} shadow-[0_16px_34px_-30px_rgba(15,35,31,0.55)]`
                      : "carte hover:-translate-y-px hover:border-pin/35"
                  }`}
                >
                  <span className={`etiquette text-[8px] ${actif ? "text-white/60" : "text-acier"}`}>
                    {option.detail}
                  </span>
                  <span className="display text-[1.8rem] leading-none">{option.titre}</span>
                  <span
                    className={`absolute right-3 top-3 h-2 w-2 ${actif ? "bg-citron" : "border border-sable"}`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          {etat.operationnelle === false && (
            <div className="mt-2.5">
              <Note ton="ambre">
                Installation non opérationnelle : le contrôle reste possible, mais cet état sera transmis avec
                chaque rapport.
              </Note>
            </div>
          )}
        </section>

        {/* Localisation */}
        <section className="monter d2 mt-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="display text-[1.15rem] text-pin">Localisation</h2>
              <p className="mt-1 text-[11px] text-acier">Position du contrôle, relevée sur l'appareil.</p>
            </div>
            <span className="etiquette text-[7px] text-acier">facultatif</span>
          </div>

          <div className="carte p-4">
            {etat.localisation ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center border border-pin/20 bg-pin/[0.04]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-pin" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z" strokeLinejoin="round" />
                        <circle cx="12" cy="10" r="2.2" />
                      </svg>
                    </span>
                    <div>
                      <p className="mono text-[13px] font-medium leading-5 text-pin">
                        {formaterPosition(etat.localisation)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-acier">
                        Précision ±{Math.round(etat.localisation.precision)} m · {formaterHeure(etat.localisation.horodatage)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 bg-citron/25 px-2 py-1 etiquette text-[7px] text-pin">enregistrée</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-sable/70 pt-3">
                  <button
                    type="button"
                    onClick={recupererPosition}
                    disabled={gpsEnCours}
                    className="text-[11px] font-medium text-pin underline decoration-citron-fonce decoration-2 underline-offset-4 disabled:opacity-50"
                  >
                    {gpsEnCours ? "Actualisation…" : "Actualiser la position"}
                  </button>
                  <button
                    type="button"
                    onClick={() => maj({ localisation: null })}
                    className="text-[10px] text-acier underline decoration-sable underline-offset-4 hover:text-argile"
                  >
                    Effacer
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-[11px] leading-5 text-acier">
                  Aucune position relevée. La géolocalisation aide la supervision à situer le contrôle ; elle
                  reste facultative si le signal est absent.
                </p>
                <button
                  type="button"
                  onClick={recupererPosition}
                  disabled={gpsEnCours}
                  className="inline-flex min-h-11 items-center gap-2 border border-pin/30 bg-white/60 px-3.5 text-[12px] font-medium text-pin transition hover:border-pin hover:bg-pin hover:text-white disabled:cursor-wait disabled:opacity-50"
                >
                  {gpsEnCours ? (
                    <span className="pouls h-2 w-2 bg-citron-fonce" aria-hidden="true" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z" strokeLinejoin="round" />
                      <circle cx="12" cy="10" r="2.2" />
                    </svg>
                  )}
                  {gpsEnCours ? "Localisation…" : "Récupérer ma position"}
                </button>
              </div>
            )}

            {gpsErreur && (
              <p role="alert" className="mt-3 border-l-2 border-argile bg-argile/[0.06] px-2.5 py-2 text-[11px] leading-5 text-argile">
                {gpsErreur}
              </p>
            )}
          </div>
        </section>

        {/* Départ */}
        <section className="monter d3 mt-6">
          <BoutonPrincipal
            className="w-full justify-between px-5"
            disabled={etat.operationnelle === null}
            onClick={() => navigate("/rapport/secteur")}
          >
            <span>Commencer le contrôle</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-citron" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="square" />
            </svg>
          </BoutonPrincipal>
          <p className="mt-2.5 text-center text-[10px] leading-5 text-acier/75">
            {etat.operationnelle === null
              ? "Choisissez l'état de l'installation pour continuer."
              : "L'état et la position seront transmis avec chaque rapport."}
          </p>
        </section>

        <div className="monter d3 mt-8 flex items-center justify-between border-t border-sable/80 pt-4">
          <span className="etiquette text-[8px] text-acier">Douches de sécurité · v4</span>
          <span className="etiquette text-[8px] text-acier/70">Étape 1 / 4</span>
        </div>
      </main>
    </div>
  );
}
