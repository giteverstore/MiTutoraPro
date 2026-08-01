export const contentMetadataConverter = Object.freeze({
  toFirestore(value) {
    const { id: _id, ...data } = value;
    return data;
  },
  fromFirestore(snapshot, options) {
    return snapshot.data(options);
  },
});
