import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as limitResults,
  orderBy as orderResults,
  query as buildQuery,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase/firestore';

function requireDocumentId(id) {
  const documentId = String(id ?? '').trim();
  if (!documentId) throw new Error('A Firestore document ID is required.');
  if (documentId.includes('/')) throw new Error('A document ID must be a single Firestore path segment.');
  return documentId;
}

function toEntity(snapshot) {
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
}

function createQueryConstraints({ filters = [], orderBy = [], limit } = {}) {
  const filterConstraints = filters.map(({ field, operator = '==', value }) => {
    if (!field) throw new Error('Firestore query filters require a field.');
    return where(field, operator, value);
  });
  const orderDescriptors = Array.isArray(orderBy) ? orderBy : [orderBy];
  const orderConstraints = orderDescriptors
    .filter(Boolean)
    .map(({ field, direction = 'asc' }) => {
      if (!field) throw new Error('Firestore query ordering requires a field.');
      return orderResults(field, direction);
    });
  const resultConstraints = [...filterConstraints, ...orderConstraints];
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Firestore query limit must be a positive integer.');
    resultConstraints.push(limitResults(limit));
  }
  return resultConstraints;
}

export class BaseRepository {
  #collection;

  constructor(collectionPath, converter) {
    if (!collectionPath) throw new Error('A Firestore collection path is required.');
    if (!converter) throw new Error('A Firestore converter is required.');
    this.#collection = collection(db, collectionPath).withConverter(converter);
  }

  #document(id) {
    return doc(this.#collection, requireDocumentId(id));
  }

  async get(id) {
    return toEntity(await getDoc(this.#document(id)));
  }

  async set(id, data) {
    const reference = this.#document(id);
    await setDoc(reference, data);
    const snapshot = await getDoc(reference);
    return toEntity(snapshot);
  }

  async update(id, partial) {
    const reference = this.#document(id);
    await updateDoc(reference, partial);
    const snapshot = await getDoc(reference);
    return toEntity(snapshot);
  }

  async remove(id) {
    await deleteDoc(this.#document(id));
  }

  async exists(id) {
    const reference = this.#document(id);
    const snapshot = await getDoc(reference);
    return snapshot.exists();
  }

  async list() {
    const snapshot = await getDocs(this.#collection);
    return snapshot.docs.map(toEntity);
  }

  async query(descriptor = {}) {
    const reference = buildQuery(this.#collection, ...createQueryConstraints(descriptor));
    const snapshot = await getDocs(reference);
    return snapshot.docs.map(toEntity);
  }

  async replaceAll(items, getId = (item) => item.id) {
    const snapshot = await getDocs(this.#collection);
    const batch = writeBatch(db);
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    items.forEach((item) => batch.set(this.#document(getId(item)), item));
    await batch.commit();
    return items;
  }
}
