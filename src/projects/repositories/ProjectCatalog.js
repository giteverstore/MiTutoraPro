import { easyProjects } from '../catalog/easyProjects.js';
import { createProject } from '../models/projectModel.js';
export class ProjectCatalog {
  constructor(records = easyProjects) { this.projects = Object.freeze(records.map(createProject)); }
  getProjects() { return this.projects; }
  getProjectById(id) { return this.projects.find((project) => project.id === id || project.slug === id) ?? null; }
  getProjectsByDifficulty(value) { return this.projects.filter(({ difficulty }) => difficulty.toLowerCase() === value.toLowerCase()); }
  getProjectsByLanguage(value) { return this.projects.filter(({ language }) => language.toLowerCase() === value.toLowerCase()); }
  getProjectsByCategory(value) { return this.projects.filter(({ category }) => category.toLowerCase() === value.toLowerCase()); }
}
export const projectCatalog = new ProjectCatalog();
