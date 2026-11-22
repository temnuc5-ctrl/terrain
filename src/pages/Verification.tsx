import { FormEvent, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CRITERES } from "../criteres";
import { useRapport } from "../context/RapportContext";
import { submitReport } from "../api/rapport";
import { MAX_PHOTOS, compresserPhoto, stockagePhotosConfigure, televerserPhotos } from "../api/photos";
import type { CleCritere, ErreurApi, PayloadRapport, PhotoDraft, Reponse } from "../types";
import { BoutonPrincipal, Entete, Note } from "../components/Chrome";

const REMARQUES_MAX = 500;

const LIBELLES: Record<Reponse, string> = {
  BON: "Bon",
  MANQUE: "Manque",
  "NON CONFORME": "Non conforme",
  "N/A": "N/A",
};

const SELECTION: Record<Reponse, string> = {
  BON: "border-pin bg-pin text-white",
  MANQUE: "border-ambre bg-ambre text-white",
  "NON CONFORME": "border-argile bg-argile text-white",
  "N/A": "border-acier bg-acier text-white",
};

const POINT: Record<Reponse, string> = {
  BON: "bg-citron",
  MANQUE: "bg-white/80",
  "NON CONFORME": "bg-white/80",
  "N/A": "bg-white/60",
};

const formaterHeure = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(new Date(iso));

const classeChamp = (erreur: boolean) =>
  `mt-1.5 block min-h-[50px] w-full border bg-[#fdfcf6] px-3.5 text-[15px] text-encre outline-none transition focus:bg-white disabled:bg-papier-creux/60 disabled:text-acier ${
    erreur ? "border-argile/60 focus:border-argile" : "border-sable focus:border-pin"
  }`;

interface Confirmation {
  id: string;
  secteur: string;
  unite: string;
  emplacement: string;
  heure: string;
  photos: number;
  operationnelle: boolean | null;
  localisation: string | null;
}

const MESSAGES_ENVOI: Record<ErreurApi["type"], string> = {
  validation: "Certaines informations ne sont pas acceptées. Vérifiez le lieu et les réponses, puis réessayez.",
  doublon: "Un rapport a déjà été transmis récemment pour cet emplacement. Réessayez dans dix minutes.",
  limite: "Trop de rapports ont été transmis en peu de temps. Réessayez dans une minute.",
  configuration:
    "La configuration Supabase est incomplète ou la fonction RPC manque. Vérifiez l'URL, la clé anon, puis appliquez les migrations.",
  reseau: "La connexion à Supabase a échoué. Vos réponses sont conservées : réessayez dès que le réseau revient.",
  serveur: "Supabase n'a pas confirmé la transmission. Vos réponses sont conservées ; réessayez.",
  stockage: "Les photos n'ont pas pu être envoyées. Vérifiez le Worker Cloudflare (VITE_PHOTOS_ENDPOINT) et la migration supabase/PHOTOS.sql.",
};

export default function PageVerification() {
  const { etat, maj, reinitialiserControle, referentiel } = useRapport();
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [tentative, setTentative] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<ErreurApi | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [copie, setCopie] = useState(false);
  const [photoErreur, setPhotoErreur] = useState("");
  const [compression, setCompression] = useState(false);
  const [envoiEtape, setEnvoiEtape] = useState("");
  const refAlerte = useRef<HTMLDivElement>(null);
  const refPhotos = useRef<HTMLInputElement>(null);
  const photosDisponibles = stockagePhotosConfigure();
  const { secteur, rapporteur } = etat;

  const lieux = useMemo(
    () => (secteur ? referentiel.lieux.filter((lieu) => lieu.secteur === secteur) : []),
    [referentiel.lieux, secteur],
  );
  const unites = useMemo(() => [...new Set(lieux.map((lieu) => lieu.unite))], [lieux]);
  const emplacements = useMemo(
    () => [...new Set(lieux.filter((lieu) => lieu.unite === etat.unite).map((lieu) => lieu.emplacement))],
    [lieux, etat.unite],
  );

  if (!secteur) return <Navigate to="/rapport/secteur" replace />;
  if (!rapporteur) return <Navigate to="/rapport/identification" replace />;

  if (confirmation) {
    const lignes: [string, string][] = [
      ["Secteur", confirmation.secteur],
      ["Unité", confirmation.unite],
      ["Emplacement", confirmation.emplacement],
      ["Contrôlé par", `${rapporteur.prenom} ${rapporteur.nom}`],
    ];
    if (confirmation.photos > 0) {
      lignes.push(["Photos", `${confirmation.photos} jointe${confirmation.photos > 1 ? "s" : ""}`]);
    }
    if (confirmation.operationnelle !== null) {
      lignes.push(["Installation", confirmation.operationnelle ? "Opérationnelle" : "Non opérationnelle"]);
    }
    if (confirmation.localisation) {
      lignes.push(["Position", confirmation.localisation]);
    }
    return (
      <div className="min-h-screen pb-10">
        <Entete etape={4} />
        <main className="mx-auto w-full max-w-xl px-5">
          <div className="monter pt-10 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-pin/20 bg-pin/[0.04]">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-pin" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 12.5l5 5L20 6.5" strokeLinecap="square" />
              </svg>
            </span>
            <p className="mt-6 etiquette text-[9px] text-citron-fonce">Confirmation d'envoi</p>
            <h1 className="display mt-2 text-[2.3rem] leading-none text-pin">Rapport transmis</h1>
            <p role="status" className="mt-3 text-[12px] leading-6 text-acier">
              Enregistré le {confirmation.heure} (heure du serveur). Les données sont désormais consultables par la
              supervision.
            </p>
          </div>

          <dl className="monter d1 carte mt-7 divide-y divide-sable/70">
            {lignes.map(([titre, valeur]) => (
              <div key={titre} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="etiquette text-[8px] text-acier">{titre}</dt>
                <dd className="text-right text-[13px] font-medium text-pin">{valeur}</dd>
              </div>
            ))}
            <div className="px-4 py-3">
              <dt className="etiquette text-[8px] text-acier">Identifiant du rapport</dt>
              <dd className="mt-1.5 flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all text-[10px] leading-5 text-encre">{confirmation.id}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(confirmation.id).then(
                      () => {
                        setCopie(true);
                        window.setTimeout(() => setCopie(false), 2000);
                      },
                      () => undefined,
                    );
                  }}
                  className="shrink-0 border border-sable px-2 py-1 etiquette text-[7px] text-pin transition hover:border-pin/40"
                >
                  {copie ? "copié" : "copier"}
                </button>
              </dd>
            </div>
          </dl>

          <div className="monter d2 mt-6 flex flex-col gap-3">
            <BoutonPrincipal
              className="w-full"
              onClick={() => {
                setConfirmation(null);
                setErreurEnvoi(null);
                setTentative(false);
              }}
            >
              Contrôler un autre emplacement
            </BoutonPrincipal>
            <Link
              to="/rapport/secteur"
              className="text-center text-[12px] text-acier underline decoration-sable underline-offset-4 transition hover:text-pin"
            >
              Changer de secteur
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const reponsesPossibles = (cle: CleCritere): Reponse[] =>
    cle === "qualite_eau" ? referentiel.reponses[secteur].qualite_eau : referentiel.reponses[secteur].defaut;

  const choisirUnite = (unite: string) => {
    const possibles = [...new Set(lieux.filter((lieu) => lieu.unite === unite).map((lieu) => lieu.emplacement))];
    maj({ unite, emplacement: possibles.length === 1 ? (possibles[0] ?? "") : "" });
  };
  const choisirReponse = (cle: CleCritere, reponse: Reponse) =>
    maj({ reponses: { ...etat.reponses, [cle]: reponse } });

  const sansReponse = CRITERES.filter((critere) => !etat.reponses[critere.cle]);
  const renseignes = CRITERES.length - sansReponse.length;
  const anomalies = CRITERES.filter((critere) => {
    const reponse = etat.reponses[critere.cle];
    return reponse === "NON CONFORME" || reponse === "MANQUE";
  }).length;
  const pretAEnvoyer = Boolean(etat.unite && etat.emplacement && sansReponse.length === 0);
  const erreurs: string[] = [];
  if (tentative) {
    if (!etat.unite) erreurs.push("Choisissez une unité.");
    if (!etat.emplacement) erreurs.push("Choisissez un emplacement.");
    if (sansReponse.length) erreurs.push(`Réponse manquante : ${sansReponse.map((c) => c.libelle).join(", ")}.`);
  }
  const focaliserAlerte = () => requestAnimationFrame(() => refAlerte.current?.focus());

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (envoiEnCours) return;
    setTentative(true);
    setErreurEnvoi(null);
    if (!pretAEnvoyer) {
      focaliserAlerte();
      return;
    }

    setEnvoiEnCours(true);
    let photos: string[] = [];
    try {
      if (etat.photos.length) {
        setEnvoiEtape(`Photos 0/${etat.photos.length}`);
        photos = await televerserPhotos(etat.photos, secteur, etat.unite, (envoyees, total) =>
          setEnvoiEtape(`Photos ${envoyees}/${total}`),
        );
      }
      setEnvoiEtape("Transmission…");
    } catch (error) {
      setEnvoiEnCours(false);
      setEnvoiEtape("");
      setErreurEnvoi({
        type: "stockage",
        message: error instanceof Error ? error.message : "Envoi des photos impossible.",
      });
      focaliserAlerte();
      return;
    }

    const payload: PayloadRapport = {
      secteur,
      rapporteur,
      unite: etat.unite,
      emplacement: etat.emplacement,
      reponses: etat.reponses as Record<CleCritere, Reponse>,
      remarques: etat.remarques.trim(),
      photos,
      operationnelle: etat.operationnelle,
      localisation: etat.localisation,
    };

    const resultat = await submitReport(payload);
    setEnvoiEnCours(false);
    setEnvoiEtape("");
    if (!resultat.ok) {
      setErreurEnvoi(resultat.erreur);
      focaliserAlerte();
      return;
    }

    setConfirmation({
      id: resultat.id,
      secteur,
      unite: etat.unite,
      emplacement: etat.emplacement,
      heure: formaterHeure(resultat.created_at),
      photos: photos.length,
      operationnelle: etat.operationnelle,
      localisation: etat.localisation
        ? `${etat.localisation.latitude.toFixed(5)}, ${etat.localisation.longitude.toFixed(5)} (±${Math.round(etat.localisation.precision)} m)`
        : null,
    });
    reinitialiserControle();
  };

  const ajouterPhotos = async (fichiers: FileList | null) => {
    if (!photosDisponibles || !fichiers?.length) return;
    setPhotoErreur("");
    const restantes = MAX_PHOTOS - etat.photos.length;
    const selection = Array.from(fichiers).slice(0, Math.max(restantes, 0));
    if (fichiers.length > restantes) {
      setPhotoErreur(`Maximum ${MAX_PHOTOS} photos par contrôle.`);
    }
    setCompression(true);
    try {
      const nouvelles: PhotoDraft[] = [];
      for (const fichier of selection) {
        nouvelles.push(await compresserPhoto(fichier));
      }
      if (nouvelles.length) maj({ photos: [...etat.photos, ...nouvelles] });
    } catch (error) {
      setPhotoErreur(error instanceof Error ? error.message : "Photo illisible.");
    } finally {
      setCompression(false);
      if (refPhotos.current) refPhotos.current.value = "";
    }
  };

  const progression = Math.round((renseignes / CRITERES.length) * 100);

  return (
    <div className="min-h-screen pb-44">
      <Entete etape={4} />

      <main className="mx-auto w-full max-w-xl px-5">
        <div className="monter pt-7">
          <p className="flex items-center gap-3 etiquette text-[9px] text-acier">
            <span className="h-px w-6 bg-citron-fonce" aria-hidden="true" />
            Contrôle terrain · vérification
          </p>
          <h1 className="display mt-3 text-[2.1rem] leading-none text-pin sm:text-[2.5rem]">Vérification</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-acier">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-pin" aria-hidden="true" />
              <strong className="font-semibold text-pin">{secteur}</strong>
            </span>
            <span className="text-sable">·</span>
            <span>{rapporteur.prenom} {rapporteur.nom}</span>
            <span className="text-sable">·</span>
            <Link to="/rapport/identification" className="underline decoration-sable underline-offset-4 hover:text-pin">
              Modifier
            </Link>
          </div>
        </div>

        <form id="rapport-form" onSubmit={envoyer} noValidate className="mt-6 space-y-6">
          {(erreurs.length > 0 || erreurEnvoi) && (
            <div
              id="erreurs-envoi"
              ref={refAlerte}
              tabIndex={-1}
              role="alert"
              className="monter border-l-2 border-argile bg-argile/[0.06] p-4"
            >
              <p className="etiquette text-[8px] text-argile">À corriger avant l'envoi</p>
              {erreurEnvoi && (
                <p className="mt-2 text-[12px] leading-5 text-argile">
                  {MESSAGES_ENVOI[erreurEnvoi.type]}
                  {erreurEnvoi.type === "stockage" && erreurEnvoi.message ? ` (${erreurEnvoi.message})` : ""}
                </p>
              )}
              {erreurs.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] leading-5 text-argile">
                  {erreurs.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Localisation */}
          <section aria-labelledby="titre-lieu" className="monter d1">
            <div className="mb-3 flex items-end justify-between">
              <h2 id="titre-lieu" className="display text-[1.15rem] text-pin">Localisation</h2>
              <span className="etiquette text-[7px] text-acier">obligatoire</span>
            </div>
            <div className="carte p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div>
                  <label htmlFor="unite" className="block text-[12px] font-medium text-pin">Unité</label>
                  <select
                    id="unite"
                    value={etat.unite}
                    onChange={(e) => choisirUnite(e.target.value)}
                    aria-invalid={tentative && !etat.unite || undefined}
                    aria-describedby={tentative && !etat.unite ? "erreurs-envoi" : undefined}
                    className={classeChamp(tentative && !etat.unite)}
                  >
                    <option value="">Choisir une unité</option>
                    {unites.map((unite) => (
                      <option key={unite} value={unite}>{unite}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="block text-[12px] font-medium text-pin">Emplacement</span>
                  {!etat.unite ? (
                    <p className="mt-2 border border-dashed border-sable px-3 py-3 text-[11px] text-acier/70">
                      Choisissez d'abord une unité.
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Emplacement">
                      {emplacements.map((emplacement) => {
                        const actif = etat.emplacement === emplacement;
                        return (
                          <button
                            key={emplacement}
                            type="button"
                            role="radio"
                            aria-checked={actif}
                            onClick={() => maj({ emplacement })}
                            className={`min-h-11 border px-2.5 py-2 text-left text-[12px] leading-5 transition ${
                              actif
                                ? "border-pin bg-pin text-white"
                                : "border-sable bg-[#fdfcf6] text-encre hover:border-pin/35"
                            }`}
                          >
                            {emplacement}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {tentative && !etat.emplacement && (
                    <p className="mt-1.5 text-[11px] text-argile">Emplacement requis.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Points de contrôle */}
          <section aria-labelledby="titre-criteres" className="monter d2">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="titre-criteres" className="display text-[1.15rem] text-pin">Points de contrôle</h2>
                <p className="mt-1 text-[11px] text-acier">12 points · répondez pour chaque équipement.</p>
              </div>
              <span className="mono shrink-0 border border-sable bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-pin">
                {renseignes}/{CRITERES.length}
              </span>
            </div>

            {sansReponse.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const complete = { ...etat.reponses };
                  for (const critere of sansReponse) complete[critere.cle] = "BON";
                  maj({ reponses: complete });
                }}
                className="mb-2 flex w-full items-center justify-between border border-dashed border-citron-fonce/60 bg-citron/[0.14] px-3.5 py-2.5 text-left transition hover:bg-citron/[0.22]"
              >
                <span className="text-[11px] font-medium text-pin">
                  Compléter les {sansReponse.length} point(s) restant(s) en « Bon »
                </span>
                <span className="etiquette text-[7px] text-pin/60">raccourci</span>
              </button>
            )}

            <div className="carte divide-y divide-sable/70">
              {CRITERES.map((critere) => {
                const options = reponsesPossibles(critere.cle);
                const choisie = etat.reponses[critere.cle];
                const manquant = tentative && !choisie;
                return (
                  <fieldset key={critere.cle} className={`px-4 py-3.5 sm:px-5 ${manquant ? "bg-argile/[0.035]" : ""}`}>
                    <legend className="w-full">
                      <span className="flex items-center gap-2.5">
                        <span className="mono grid h-6 w-6 shrink-0 place-items-center border border-sable bg-papier text-[10px] text-acier">
                          {String(critere.numero).padStart(2, "0")}
                        </span>
                        <span className="flex-1 text-[13px] font-medium text-encre">{critere.libelle}</span>
                        {choisie && choisie !== "BON" && (
                          <span className={`etiquette text-[7px] ${choisie === "N/A" ? "text-acier" : choisie === "MANQUE" ? "text-ambre" : "text-argile"}`}>
                            {LIBELLES[choisie]}
                          </span>
                        )}
                      </span>
                    </legend>
                    <div
                      className={`mt-2.5 grid gap-1.5 ${
                        options.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
                      }`}
                    >
                      {options.map((reponse) => {
                        const actif = choisie === reponse;
                        return (
                          <label key={reponse} className="cursor-pointer">
                            <input
                              type="radio"
                              name={critere.cle}
                              value={reponse}
                              checked={actif}
                              onChange={() => choisirReponse(critere.cle, reponse)}
                              className="peer sr-only"
                            />
                            <span
                              className={`flex min-h-11 items-center justify-center gap-1.5 border px-2 text-center text-[12px] font-medium transition-colors ${
                                actif
                                  ? SELECTION[reponse]
                                  : "border-sable bg-[#fdfcf6] text-encre hover:border-pin/30 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pin"
                              }`}
                            >
                              {actif && <span className={`h-1.5 w-1.5 ${POINT[reponse]}`} aria-hidden="true" />}
                              {LIBELLES[reponse]}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {manquant && <p className="mt-1.5 text-[11px] text-argile">Réponse requise.</p>}
                  </fieldset>
                );
              })}
            </div>
          </section>

          {/* Remarques */}
          <section className="monter d3">
            <div className="mb-3 flex items-end justify-between">
              <label htmlFor="remarques" className="display text-[1.15rem] text-pin">Remarques</label>
              <span className="etiquette text-[7px] text-acier">facultatif</span>
            </div>
            <textarea
              id="remarques"
              rows={3}
              maxLength={REMARQUES_MAX}
              value={etat.remarques}
              onChange={(e) => maj({ remarques: e.target.value })}
              placeholder="Précisez une anomalie, une pièce manquante, l'état de l'eau…"
              className={`${classeChamp(false)} resize-y py-3 placeholder:text-[13px] placeholder:text-acier/45`}
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-acier/70">Visible par la supervision</span>
              <span className="mono text-[10px] tabular-nums text-acier">{etat.remarques.length}/{REMARQUES_MAX}</span>
            </div>
          </section>

          {/* Photos */}
          <section className="monter d3">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="display text-[1.15rem] text-pin">Photos</h2>
                <p className="mt-1 text-[11px] text-acier">Une image vaut mieux qu'une longue remarque.</p>
              </div>
              <span className="mono shrink-0 border border-sable bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-pin">
                {etat.photos.length}/{MAX_PHOTOS}
              </span>
            </div>
            <div className="carte p-3.5">
              <div className="grid grid-cols-3 gap-2">
                {etat.photos.map((photo, index) => (
                  <figure key={photo.id} className="relative aspect-square overflow-hidden border border-sable bg-papier">
                    <img
                      src={photo.dataUrl}
                      alt={`Photo ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => maj({ photos: etat.photos.filter((p) => p.id !== photo.id) })}
                      aria-label={`Retirer la photo ${index + 1}`}
                      className="absolute right-1 top-1 grid h-7 w-7 place-items-center bg-pin/90 text-[15px] leading-none text-white transition hover:bg-argile"
                    >
                      ×
                    </button>
                    <figcaption className="absolute inset-x-0 bottom-0 bg-pin/80 px-1.5 py-0.5 mono text-[8px] text-white/85">
                      {Math.max(1, Math.round(photo.taille / 1024))} Ko
                    </figcaption>
                  </figure>
                ))}

                {photosDisponibles && etat.photos.length < MAX_PHOTOS && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed border-sable bg-[#fdfcf6] text-acier transition hover:border-pin/40 hover:text-pin">
                    <input
                      ref={refPhotos}
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => ajouterPhotos(e.target.files)}
                      disabled={compression}
                    />
                    {compression ? (
                      <span className="pouls h-2.5 w-2.5 bg-citron-fonce" aria-hidden="true" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <path d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4z" strokeLinejoin="round" />
                        <circle cx="12" cy="13.2" r="3.2" />
                      </svg>
                    )}
                    <span className="etiquette text-[7px]">{compression ? "compression" : "ajouter"}</span>
                  </label>
                )}
              </div>
              <p className="mt-2.5 text-[10px] leading-5 text-acier/75">
                {photosDisponibles
                  ? "JPEG compressé à 1600 px · 3 photos maximum · environ 250 Ko par image. Les photos sont stockées sur Cloudflare R2 et rattachées au rapport."
                  : "Stockage photos non configuré : renseignez VITE_PHOTOS_ENDPOINT (Worker Cloudflare) puis redéployez."}
              </p>
              {photoErreur && (
                <p role="alert" className="mt-2 border-l-2 border-argile bg-argile/[0.06] px-2.5 py-2 text-[11px] leading-5 text-argile">
                  {photoErreur}
                </p>
              )}
            </div>
          </section>

          {anomalies > 0 && (
            <Note ton="ambre">
              {anomalies} point(s) en anomalie : le rapport sera marqué « non conforme » et apparaîtra en priorité
              dans la synthèse.
            </Note>
          )}
        </form>
      </main>

      {/* Barre d'envoi fixe */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sable bg-papier/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto w-full max-w-xl px-5">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-baseline gap-2">
              <span className="mono text-[13px] font-semibold text-pin">{renseignes}/{CRITERES.length}</span>
              <span className="text-[10px] text-acier">points</span>
              {anomalies > 0 && (
                <>
                  <span className="text-sable">·</span>
                  <span className="text-[10px] font-medium text-ambre">{anomalies} anomalie{anomalies > 1 ? "s" : ""}</span>
                </>
              )}
            </div>
            <span className="etiquette text-[7px] text-acier/70" aria-live="polite">
              {pretAEnvoyer ? "prêt à transmettre" : "en cours"}
            </span>
          </div>
          <div className="h-[3px] w-full overflow-hidden bg-sable/70" aria-hidden="true">
            <div
              className={`h-full origin-left transition-transform duration-300 ${anomalies > 0 ? "bg-ambre" : "bg-pin"}`}
              style={{ transform: `scaleX(${progression / 100})` }}
            />
          </div>
          <div className="py-3">
            <BoutonPrincipal
              type="submit"
              disabled={envoiEnCours}
              onClick={() => {
                const form = document.getElementById("rapport-form") as HTMLFormElement | null;
                form?.requestSubmit();
              }}
              className="w-full justify-between px-5"
            >
              <span>{envoiEnCours ? envoiEtape || "Transmission…" : "Transmettre le rapport"}</span>
              {envoiEnCours ? (
                <span className="pouls h-2 w-2 bg-citron" aria-hidden="true" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-citron" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="square" />
                </svg>
              )}
            </BoutonPrincipal>
          </div>
        </div>
      </div>
    </div>
  );
}
