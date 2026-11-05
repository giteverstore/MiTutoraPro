import { composeInstructionalGuide, currencyConverterInstructionalSections } from './projectInstructionalGuide.js';

const command = { type: 'runtime-command', command: 'run' };
const validation = (...checks) => ({ type: 'project-checks', checks });
const source = (id, name, patternsByLanguage) => ({ id, name, type: 'source_matches', patternsByLanguage, visible: true });
const patterns = (python, cpp, java) => ({ python: [python], cpp: [cpp], java: [java] });

const tasks = [
  ['welcome', 'Welcome Header', 'Create the entry file and print the official converter greeting.', ['Create Converter.py, Converter.cpp, or Converter.java.', 'Define print_welcome() or printWelcome().', 'Print “Welcome to Multi-Unit & Currency Converter CLI!”.'], patterns('(?:print_welcome|Welcome to Multi-Unit)', '(?:printWelcome|Welcome to Multi-Unit)', '(?:printWelcome|Welcome to Multi-Unit)')],
  ['currency-rates', 'Currency Rates', 'Define the fixed USD-based exchange-rate lookup table.', ['Define USD 1.0, EUR 0.92, GBP 0.79, INR 83.0, JPY 155.0, and CAD 1.36.', 'Keep USD as the base reference.'], patterns('CURRENCY_RATES[\\s\\S]+83(?:\\.0)?[\\s\\S]+155(?:\\.0)?', 'CURRENCY_RATES[\\s\\S]+83(?:\\.0)?[\\s\\S]+155(?:\\.0)?', 'CURRENCY_RATES[\\s\\S]+83(?:\\.0)?[\\s\\S]+155(?:\\.0)?')],
  ['currency', 'Currency Conversion', 'Convert through the USD pivot using the source-defined fixed rates.', ['Divide the amount by the source rate.', 'Multiply the USD amount by the target rate.', 'Return the converted amount.'], patterns('convert_currency', 'convertCurrency', 'convertCurrency')],
  ['length-ratios', 'Length Ratios', 'Define length ratios relative to meters.', ['Define m 1.0, km 1000.0, mi 1609.344, ft 0.3048, and in 0.0254.'], patterns('LENGTH_RATIOS', 'LENGTH_RATIOS', 'LENGTH_RATIOS')],
  ['length', 'Length Conversion', 'Convert length through the meter pivot.', ['Multiply by the source ratio to get meters.', 'Divide by the target ratio.'], patterns('convert_length', 'convertLength', 'convertLength')],
  ['weight-ratios', 'Weight Ratios', 'Define weight ratios relative to kilograms.', ['Define kg 1.0, g 0.001, lbs 0.45359237, and oz 0.028349523125.'], patterns('WEIGHT_RATIOS', 'WEIGHT_RATIOS', 'WEIGHT_RATIOS')],
  ['weight', 'Weight Conversion', 'Convert mass through the kilogram pivot.', ['Multiply by the source ratio to get kilograms.', 'Divide by the target ratio.'], patterns('convert_weight', 'convertWeight', 'convertWeight')],
  ['temperature', 'Temperature Conversion', 'Convert between C, F, and K through Celsius while enforcing absolute zero.', ['Reject C below -273.15, F below -459.67, and K below 0.', 'Convert the source scale to Celsius.', 'Project Celsius to the target scale.'], patterns('convert_temperature[\\s\\S]+(?:absolute_zero|273\\.15)', 'convertTemperature[\\s\\S]+(?:absoluteZero|273\\.15)', 'convertTemperature[\\s\\S]+(?:absoluteZero|273\\.15)')],
  ['numbers', 'Numeric Validation', 'Read valid non-negative amounts and physically valid temperatures.', ['Reject malformed numeric input.', 'Reject negative currency, length, and weight values.', 'Reject temperatures below absolute zero.'], patterns('(?:get_positive_number|get_temperature_number)', '(?:getPositiveNumber|getTemperatureNumber)', '(?:getPositiveNumber|getTemperatureNumber)')],
  ['units', 'Unit Validation', 'Read unit codes case-insensitively until a supported unit is supplied.', ['Trim input.', 'Compare unit codes without case sensitivity.', 'Report allowed options and re-prompt after invalid input.'], patterns('get_valid_unit', 'getValidUnit', 'getValidUnit')],
  ['handlers', 'Conversion Handlers', 'Build interactive handlers for currency, length, weight, and temperature.', ['Prompt source and target units and amount.', 'Display financial values to 2 decimals and rates to 4 decimals.', 'Display scientific ratios to 4 decimals.', 'Use the source-defined supported units.'], patterns('handle_currency[\\s\\S]+handle_length[\\s\\S]+handle_weight[\\s\\S]+handle_temperature', 'handleCurrency[\\s\\S]+handleLength[\\s\\S]+handleWeight[\\s\\S]+handleTemperature', 'handleCurrency[\\s\\S]+handleLength[\\s\\S]+handleWeight[\\s\\S]+handleTemperature')],
  ['main', 'Menu and Application Assembly', 'Create the five-option menu loop and route every conversion workflow.', ['Print the welcome header.', 'Offer Currency, Length, Weight, Temperature, and Exit options.', 'Route choices 1–4 to their handlers.', 'Reject invalid choices.', 'Print the farewell and exit on option 5.'], patterns('(?:def\\s+main|__name__)[\\s\\S]+Invalid choice', 'int\\s+main[\\s\\S]+Invalid choice', 'static\\s+void\\s+main[\\s\\S]+Invalid choice')],
];

const checkpoints = tasks.map(([id, title, objective, requirements, taskPatterns], index) => ({
  id: `currency-converter-task-${index + 1}`, title: `Task ${index + 1}: ${title}`, objective,
  executionMode: 'run_or_terminal', requirements, completionMessage: `${title} milestone verified.`,
  validation: validation(source(id, title, taskPatterns)),
  guide: [{ type: 'heading', text: title }, { type: 'paragraph', text: objective }, { type: 'list', items: requirements }, command],
}));

const starters = {
  python: [{ path: 'Converter.py', content: '"""Multi-Unit & Currency Converter project starter."""\n\n\ndef print_welcome():\n    print("Welcome to Multi-Unit & Currency Converter CLI!")\n\n\ndef main():\n    print_welcome()\n\n\nif __name__ == "__main__":\n    main()\n' }],
  cpp: [{ path: 'Converter.cpp', content: '#include <iostream>\n\nvoid printWelcome() {\n  std::cout << "Welcome to Multi-Unit & Currency Converter CLI!" << std::endl;\n}\n\nint main() {\n  printWelcome();\n  return 0;\n}\n' }],
  java: [{ path: 'Converter.java', content: 'public class Converter {\n  static void printWelcome() {\n    System.out.println("Welcome to Multi-Unit & Currency Converter CLI!");\n  }\n\n  public static void main(String[] args) {\n    printWelcome();\n  }\n}\n' }],
};

const finalValidation = validation(
  { id: 'currency-converter-runs', name: 'Converter application starts', type: 'execution', outputIncludes: ['Welcome to Multi-Unit & Currency Converter CLI!'], stdin: '', visible: true },
  ...tasks.slice(1).map(([id, title, , , taskPatterns]) => source(`final-${id}`, title, taskPatterns)),
);

export const currencyConverterProject = {
  id: 'currency-converter', slug: 'currency-converter', title: 'Multi-Unit & Currency Converter CLI', difficulty: 'Beginner', category: 'Command-line utilities', estimatedMinutes: 0,
  description: 'Build a resilient terminal utility for currency, length, weight, and temperature conversions using base-unit pivots.',
  supportedLanguages: ['python', 'cpp', 'java'],
  whatYouWillBuild: 'A menu-driven converter with fixed local USD exchange rates, metric and imperial length and weight ratios, Celsius-based temperature formulas, physical boundary checks, case-insensitive units, and precise formatted output.',
  learningObjectives: ['Design lookup tables with dictionaries or maps.', 'Use the Base Unit Pivot Pattern.', 'Implement linear currency, distance, and mass conversions.', 'Implement offset-based temperature conversions.', 'Enforce non-negative values and absolute zero.', 'Format financial values to 2 decimals and scientific ratios to 4 decimals.', 'Build resilient case-insensitive menu navigation.'],
  prerequisites: ['Formatted output and keyboard input', 'Variables, conditionals, and loops', 'Maps, dictionaries, or associative arrays', 'Floating-point arithmetic and formatting', 'Functions and subroutines', 'String case manipulation and exception handling'],
  skills: ['Lookup tables', 'Base-unit pivots', 'Floating-point arithmetic', 'Input validation', 'Numeric formatting', 'Menu routing'],
  guide: [{ type: 'paragraph', text: 'Build the converter in the exact 12-task order using only the fixed local rates and units defined in the project.' }, command],
  guidePages: composeInstructionalGuide(checkpoints, currencyConverterInstructionalSections),
  languageOverrides: {
    python: { entrypoint: 'Converter.py', runCommand: 'python Converter.py', defaultFiles: starters.python },
    cpp: { entrypoint: 'Converter.cpp', buildCommand: 'g++ Converter.cpp -o Converter', runCommand: './Converter', defaultFiles: starters.cpp },
    java: { entrypoint: 'Converter.java', buildCommand: 'javac Converter.java', runCommand: 'java Converter', defaultFiles: starters.java },
  },
  checkpoints, finalValidation, export: { repositoryName: 'currency-converter' },
};
