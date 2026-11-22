import type { PhotoDraft } from '../types';

export const MAX_PHOTOS = 3;
const MAX_SOURCE = 20 * 1024 * 1024; // 20 Mo avant compression
const MAX_DIMENSION = 1600;
const QUALITE = 0.72;

const nettoyer = (valeur: string) =>
  valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/** Le stockage photos est-il configuré (Worker Cloudflare) ? */
export function stockagePhotosConfigure(): boolean {
  return Boolean(import.meta.env.VITE_PHOTOS_ENDPOINT);
}

/**
 * Compresse la photo dans le navigateur avant l'envoi : 1600 px maximum,
 * JPEG qualité 0,72. Une photo de téléphone passe ainsi de ~4 Mo à ~200-300 Ko.
 */
export async function compresserPhoto(file: File): Promise<PhotoDraft> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`« ${file.name} » n'est pas une image.`);
  }
  if (file.size > MAX_SOURCE) {
    throw new Error(`« ${file.name} » dépasse 20 Mo.`);
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
  } catch {
    bitmap = null;
  }

  let largeur: number;
  let hauteur: number;
  let source: CanvasImageSource;
  let urlTemporaire: string | null = null;

  if (bitmap) {
    largeur = bitmap.width;
    hauteur = bitmap.height;
    source = bitmap;
  } else {
    urlTemporaire = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Format d'image non pris en charge : ${file.name}`));
      img.src = urlTemporaire!;
    });
    largeur = image.naturalWidth;
    hauteur = image.naturalHeight;
    source = image;
  }

  const ratio = Math.min(1, MAX_DIMENSION / Math.max(largeur, hauteur));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(largeur * ratio));
  canvas.height = Math.max(1, Math.round(hauteur * ratio));
  const contexte = canvas.getContext('2d');
  if (!contexte) throw new Error("Cet appareil ne permet pas de compresser l'image.");
  contexte.imageSmoothingQuality = 'high';
  contexte.drawImage(source, 0, 0, canvas.width, canvas.height);
  bitmap?.close();
  if (urlTemporaire) URL.revokeObjectURL(urlTemporaire);

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITE);
  const blob = await (await fetch(dataUrl)).blob();
  const identifiant =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id: identifiant,
    nom: `${file.name.replace(/\.[^.]+$/, '')}.jpg`,
    dataUrl,
    taille: blob.size,
  };
}

/**
 * Envoie les photos compressées au Worker Cloudflare, qui les écrit dans R2.
 * Aucune clé R2 ni Supabase service_role ne transite dans le navigateur.
 */
export async function televerserPhotos(
  photos: PhotoDraft[],
  secteur: string,
  unite: string,
  onProgress?: (envoyees: number, total: number) => void,
): Promise<string[]> {
  if (!photos.length) return [];

  const endpoint = import.meta.env.VITE_PHOTOS_ENDPOINT?.replace(/\/$/, '');
  if (!endpoint) {
    throw new Error("Stockage photos non configuré : renseignez VITE_PHOTOS_ENDPOINT.");
  }
  const token = import.meta.env.VITE_PHOTOS_TOKEN;

  const urls: string[] = [];
  for (let index = 0; index < photos.length; index += 1) {
    onProgress?.(index + 1, photos.length);
    const blob = await (await fetch(photos[index].dataUrl)).blob();
    const reponse = await fetch(`${endpoint}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'X-File-Name': encodeURIComponent(photos[index].nom),
        'X-Secteur': encodeURIComponent(secteur),
        'X-Unite': encodeURIComponent(unite || 'unite'),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: blob,
    });

    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => '');
      throw new Error(
        reponse.status === 401
          ? 'Le Worker photos a refusé la clé (VITE_PHOTOS_TOKEN).'
          : `Envoi de la photo impossible (${reponse.status}). ${detail.slice(0, 120)}`,
      );
    }

    const resultat = (await reponse.json()) as { url?: string };
    if (!resultat.url) throw new Error("Le Worker photos n'a pas renvoyé d'URL.");
    urls.push(resultat.url);
  }

  return urls;
}
