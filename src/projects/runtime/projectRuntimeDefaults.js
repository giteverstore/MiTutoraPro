// Browser-independent source of the bundled Project starter workspaces.
export const PROJECT_RUNTIME_DEFAULTS = Object.freeze({
  python: { fileExtension: '.py', runCommand: 'python main.py', filesystem: { multiFile: true, mutationCapture: true, persistentRuns: true }, defaultFiles: [{ path: 'main.py', content: 'print("CLI Task Manager")\n' }] },
  javascript: { fileExtension: '.js', runtime: 'Node.js', runCommand: 'node index.js', packageManager: 'npm', filesystem: { multiFile: true, mutationCapture: true, persistentRuns: true }, defaultFiles: [{ path: 'index.js', content: 'console.log("CLI Task Manager");\n' }] },
  java: { fileExtension: '.java', buildCommand: 'javac Main.java', runCommand: 'java Main', filesystem: { multiFile: true, mutationCapture: false, persistentRuns: false }, defaultFiles: [{ path: 'Main.java', content: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("CLI Task Manager");\n  }\n}\n' }] },
  cpp: { fileExtension: '.cpp', buildCommand: 'g++ main.cpp -o app', runCommand: './app', filesystem: { multiFile: true, mutationCapture: true, persistentRuns: true }, defaultFiles: [{ path: 'main.cpp', content: '#include <iostream>\nint main() {\n  std::cout << "CLI Task Manager" << std::endl;\n  return 0;\n}\n' }] },
});
