import { useEffect } from 'react';
import { ArrowRight, BookOpen, Bot, Braces, CheckCircle2, Database, FolderCode, Play, TerminalSquare } from 'lucide-react';
import { browseCatalog } from '../home/homeData';
import { projectCatalog } from '../projects/repositories/ProjectCatalog';
import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';
import { requestAuthentication } from './publicAuthNavigation';

function LandingMetadata() {
  useEffect(() => {
    const previousTitle = document.title;
    let description = document.head.querySelector('meta[name="description"]');
    const created = !description;
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.append(description); }
    const previousDescription = description.content;
    document.title = 'Y Coders - Learn Coding by Building';
    description.content = 'Learn programming through structured courses, coding practice, and real projects with Y Coders.';
    return () => { document.title = previousTitle; if (created) description.remove(); else description.content = previousDescription; };
  }, []);
  return null;
}

function CodePreview() {
  return <div className="landing-code-preview" aria-label="Example Y Coders coding workspace"><header><span><TerminalSquare /> main.py</span><button type="button" tabIndex={-1}><Play /> Run</button></header><pre><code><span>message</span> = <em>&quot;Hello, Y Coders!&quot;</em>{'\n'}<span>print</span>(message)</code></pre><footer><strong>Output</strong><code>Hello, Y Coders!</code><span><CheckCircle2 /> Passed</span></footer></div>;
}

const courses = browseCatalog.languages.filter(({ available }) => available).slice(0, 3);
const projects = projectCatalog.getProjects().slice(0, 3);

export function LandingPage() {
  return <div className="landing-page" data-brand-theme="blue" data-theme="light"><LandingMetadata /><PublicHeader activePath="/" /><main>
    <section className="landing-hero"><div className="landing-hero-grid" aria-hidden="true" /><div className="landing-hero-copy"><span className="landing-eyebrow">From Beginner to Builder - With Y Coders</span><h1>From &quot;I Understand&quot; to <span>&quot;I Built It.&quot;</span></h1><p>Learn programming by writing code, solving problems, and building real projects.</p><div><button className="button button--primary" type="button" onClick={() => requestAuthentication('/', 'signup')}>Get Started <ArrowRight /></button><a className="button button--secondary" href="/library">Explore Courses</a></div></div><CodePreview /></section>
    <section className="landing-split landing-doing"><div><span className="landing-eyebrow">Learn by doing</span><h2>Don't Just Learn. Start Building.</h2><p>Write code, solve focused exercises, work with data, and turn concepts into practical projects - all inside one learning workspace.</p><div className="landing-pills"><span><Braces /> Code</span><span><Database /> SQL</span><span><TerminalSquare /> Practice</span><span><FolderCode /> Projects</span><span><Bot /> AI Tutor</span></div></div><CodePreview /></section>
    <section className="landing-showcase" aria-labelledby="landing-courses-title"><header><div><span className="landing-eyebrow">Structured paths</span><h2 id="landing-courses-title">Courses that move from concept to code.</h2></div><a href="/library">Explore Courses <ArrowRight /></a></header><div className="landing-card-grid">{courses.map((course) => <a className="landing-content-card" href={`/courses/${course.id}`} key={course.id}><BookOpen /><span>{course.level}</span><h3>{course.title}</h3><p>{course.description}</p><small>{course.duration} - {course.lessonCount} lessons</small></a>)}</div></section>
    <section className="landing-split"><div><span className="landing-eyebrow">Practice</span><h2>Practice What You Learn.</h2><p>Browse coding questions by topic and difficulty, then sign in when you are ready to run solutions and track completion.</p><a className="button button--primary" href="/practice">Explore Practice <ArrowRight /></a></div><div className="landing-question-visual" aria-label="Practice question preview"><span>Python - Easy</span><h3>Create a User Label</h3><p>Use supplied values to return a formatted label.</p><code>create_user_label(name, age)</code><div><span>Functions</span><span>Strings</span></div></div></section>
    <section className="landing-projects"><div className="landing-section-copy"><span className="landing-eyebrow">Real-world projects</span><h2>Don't Just Learn. Build Something Real.</h2><p>Explore guided projects that turn programming fundamentals into practical, portfolio-ready work.</p><a className="button button--secondary" href="/projects">Explore Projects <ArrowRight /></a></div><div className="landing-card-grid">{projects.map((project) => <a className="landing-content-card" href="/projects" key={project.id}><FolderCode /><span>{project.difficulty} - {project.language}</span><h3>{project.title}</h3><p>{project.description}</p></a>)}</div></section>
    <section className="landing-split landing-mentor"><div><span className="landing-eyebrow">Guidance when you need it</span><h2>Stuck on Code? Ask Your AI Mentor.</h2><p>Get concept explanations, debugging guidance, and step-by-step support inside eligible learning experiences. Authentication and Premium access are required.</p><button className="button button--primary" type="button" onClick={() => requestAuthentication('/practice', 'login')}>Try AI Mentor <ArrowRight /></button></div><div className="landing-mentor-visual" aria-label="AI coding mentor preview"><Bot /><div><strong>AI Tutor</strong><p>Let's trace the function one step at a time. What value does the first condition receive?</p></div></div></section>
    <section className="landing-how" aria-labelledby="landing-how-title"><span className="landing-eyebrow">How it works</span><h2 id="landing-how-title">A practical path from learning to building.</h2><ol>{[['01', 'Learn', 'Follow structured courses.'], ['02', 'Practice', 'Solve programming problems.'], ['03', 'Build', 'Create real projects.'], ['04', 'Grow', 'Track progress, complete challenges, and build a portfolio.']].map(([number, title, copy]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol></section>
    <section className="landing-final-cta"><div><span className="landing-eyebrow">Start building today</span><h2>Learn to code with Y Coders.</h2><p>Move from reading concepts to writing code that works.</p></div><button className="button button--primary" type="button" onClick={() => requestAuthentication('/', 'signup')}>Get Started <ArrowRight /></button></section>
  </main><PublicFooter /></div>;
}
