function createIdentityConverter() {
  return Object.freeze({
    toFirestore(model) {
      const { id: _documentId, ...data } = model;
      return data;
    },
    fromFirestore(snapshot, options) {
      return snapshot.data(options);
    },
  });
}

export const userConverter = createIdentityConverter();
export const courseConverter = createIdentityConverter();
export const progressConverter = createIdentityConverter();
export const settingsConverter = createIdentityConverter();
export const bookmarkConverter = createIdentityConverter();
export const certificateConverter = createIdentityConverter();
export const referralConverter = createIdentityConverter();
