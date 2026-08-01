import { userDataService } from '../user-data/UserDataService';

export const bookmarkRepository = {
  load(userId) {
    return userDataService.loadBookmarks(userId);
  },
  save(userId, bookmarks) {
    return userDataService.saveBookmarks(userId, bookmarks);
  },
  clear(userId) {
    return userDataService.clearBookmarks(userId);
  },
};
