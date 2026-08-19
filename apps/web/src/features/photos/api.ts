import {
  memberAvatarsResponseSchema,
  okResponseSchema,
  photoListResponseSchema,
  photoResponseSchema,
  uploadTargetResponseSchema,
  type ConfirmPhotoInput,
  type Photo,
  type UpdatePhotoInput,
  type UploadTarget,
} from '@fh/shared';
import { apiRequest } from '@/lib/api-client';

export const photoKeys = {
  all: (familyId: string) => ['families', familyId, 'photos'] as const,
  list: (familyId: string) => [...photoKeys.all(familyId), 'list'] as const,
  ofMember: (familyId: string, memberId: string) =>
    [...photoKeys.all(familyId), 'member', memberId] as const,
  avatars: (familyId: string) => [...photoKeys.all(familyId), 'avatars'] as const,
};

export async function createUploadTarget(familyId: string): Promise<UploadTarget> {
  const { target } = await apiRequest(
    `/families/${familyId}/photos/upload-target`,
    uploadTargetResponseSchema,
    { method: 'POST' },
  );
  return target;
}

/**
 * Sends the file straight to the storage provider.
 *
 * Deliberately not through apiRequest: this request does not go to our API at
 * all. It uses XMLHttpRequest rather than fetch for one reason - upload
 * progress. fetch still cannot report it, and a photograph uploading over a
 * slow connection with no feedback looks broken.
 */
export function uploadToStorage(
  target: UploadTarget,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(target.params)) {
      form.append(key, value);
    }
    form.append('file', file);

    const request = new XMLHttpRequest();
    request.open('POST', target.uploadUrl);

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error('The upload was rejected. Try again.'));
    });
    request.addEventListener('error', () =>
      reject(new Error('The upload failed. Check your connection.')),
    );

    request.send(form);
  });
}

export async function confirmPhoto(
  familyId: string,
  body: ConfirmPhotoInput,
): Promise<Photo> {
  const { photo } = await apiRequest(`/families/${familyId}/photos`, photoResponseSchema, {
    method: 'POST',
    body,
  });
  return photo;
}

export async function listPhotos(familyId: string): Promise<Photo[]> {
  const { photos } = await apiRequest(`/families/${familyId}/photos`, photoListResponseSchema);
  return photos;
}

export async function listMemberPhotos(
  familyId: string,
  memberId: string,
): Promise<Photo[]> {
  const { photos } = await apiRequest(
    `/families/${familyId}/members/${memberId}/photos`,
    photoListResponseSchema,
  );
  return photos;
}

export async function getMemberAvatars(familyId: string): Promise<Record<string, string>> {
  const { avatars } = await apiRequest(
    `/families/${familyId}/photos/member-avatars`,
    memberAvatarsResponseSchema,
  );
  return avatars;
}

export async function updatePhoto(
  familyId: string,
  photoId: string,
  body: UpdatePhotoInput,
): Promise<Photo> {
  const { photo } = await apiRequest(
    `/families/${familyId}/photos/${photoId}`,
    photoResponseSchema,
    { method: 'PATCH', body },
  );
  return photo;
}

export async function setPrimaryPhoto(
  familyId: string,
  memberId: string,
  photoId: string | null,
): Promise<void> {
  await apiRequest(`/families/${familyId}/members/${memberId}/primary-photo`, okResponseSchema, {
    method: 'POST',
    body: { photoId },
  });
}

export async function deletePhoto(familyId: string, photoId: string): Promise<void> {
  await apiRequest(`/families/${familyId}/photos/${photoId}`, okResponseSchema, {
    method: 'DELETE',
  });
}