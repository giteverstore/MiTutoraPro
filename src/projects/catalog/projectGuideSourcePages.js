// Generated from Word-paginated authoritative DOCX files. Do not hand-condense.
export const PROJECT_GUIDE_SOURCE_CONTRACTS = Object.freeze({
  "blackjack": {
    "physicalPageCount": 48,
    "taskPages": [
      4,
      6,
      11,
      13,
      15,
      17,
      19,
      21,
      23,
      25,
      27,
      30,
      32,
      35,
      37,
      39
    ],
    "mergePolicy": "one-physical-page-per-guide-page",
    "sourceDocument": "docs/project-content/blackjack/Blackjack.docx",
    "sourceSha256": "1A0E7AE12AFAD9C29C80CFE24A12AA4427D542158FC36292F0A0F34F89C1F1DD"
  },
  "hangman": {
    "physicalPageCount": 31,
    "taskPages": [
      4,
      5,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20,
      21,
      23,
      24,
      25
    ],
    "mergePolicy": "one-physical-page-per-guide-page",
    "sourceDocument": "docs/project-content/Hangman/Hangman.docx",
    "sourceSha256": "F8F957B8DDC960820F03348DBA2FCC20EBAB59C3233A573133B358E542A0E3B3"
  },
  "stone-paper-scissors": {
    "physicalPageCount": 51,
    "taskPages": [
      4,
      6,
      12,
      14,
      16,
      18,
      20,
      23,
      25,
      27,
      29,
      31,
      34,
      36,
      39,
      41,
      43
    ],
    "mergePolicy": "one-physical-page-per-guide-page",
    "sourceDocument": "docs/project-content/Stone Paper Scissors/StonePaperScissors.docx",
    "sourceSha256": "4239F19B484A8DE84AD089E788049195C4CFFF31F514D396D1987ECE4D9C6B61"
  },
  "currency-converter": {
    "physicalPageCount": 37,
    "taskPages": [
      4,
      6,
      11,
      13,
      15,
      17,
      19,
      21,
      23,
      25,
      27,
      29
    ],
    "mergePolicy": "one-physical-page-per-guide-page",
    "sourceDocument": "docs/project-content/Currency Converter/Currency Converter.docx",
    "sourceSha256": "1804FC0EEA72ABC4167E9EAF82D4DF4627BE03A4D11A5DE960F0010BFB22087E"
  }
});

export const PROJECT_GUIDE_SOURCE_PAGES = Object.freeze({
  "blackjack": [
    {
      "id": "blackjack-source-page-01",
      "sourcePageStart": 1,
      "sourcePageEnd": 1,
      "sourcePages": [
        1
      ],
      "title": "Blackjack Game",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "Chapter 1: Introduction"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "1.1 Getting Started"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Meet Your Project"
        },
        {
          "type": "paragraph",
          "text": "You are about to build Blackjack — the world's most famous casino card game — as an interactive, turn-based command-line application where you face off against the Dealer (the automated casino opponent) to see who can get closest to 21 without going over."
        },
        {
          "type": "paragraph",
          "text": "This project reinforces essential core programming concepts: defining custom domain structures, populating and shuffling collections, implementing dynamic score calculation with dual-value cards (Aces), managing hidden versus revealed state, driving turn-based interactive loops, tracking cumulative session statistics, and structuring code cleanly into modular classes."
        },
        {
          "type": "paragraph",
          "text": "Once completed, you will have a fully playable, polished card game that accurately handles standard card values, automatically adjusts Aces when hands exceed 21, enforces authentic dealer drawing rules, records your wins, losses, and pushes across rounds, and invites players to play again."
        }
      ]
    },
    {
      "id": "blackjack-source-page-02",
      "sourcePageStart": 2,
      "sourcePageEnd": 2,
      "sourcePages": [
        2
      ],
      "title": "What You Will Learn",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You will construct this application from start to finish. By the end, you will have a robust, tested project you can run, explain, and expand."
        },
        {
          "type": "paragraph",
          "text": "You will learn how to:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Represent individual playing cards using custom classes and structures with ranks and suits",
            "Generate and shuffle a standard 52-card deck using built-in language randomization tools",
            "Implement the classic dual-value Ace rule (counting as 11, or automatically dropping to 1 to avoid busting)",
            "Deal cards from the deck and manage partially hidden state (the Dealer's hole card)",
            "Read and validate player choices (Hit versus Stand) with defensive error handling",
            "Automate the Dealer's turn using casino standard rules (hit until reaching 17 or higher)",
            "Determine round outcomes (Player Win, Dealer Win, Busts, and Ties/Pushes)",
            "Maintain a persistent session scoreboard tracking Wins, Losses, and Ties across multiple rounds",
            "Encapsulate game state and lifecycle logic into a clean, modular class"
          ]
        }
      ]
    },
    {
      "id": "blackjack-source-page-03",
      "sourcePageStart": 3,
      "sourcePageEnd": 3,
      "sourcePages": [
        3
      ],
      "title": "What You Need",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Before you begin, make sure you are comfortable with:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Printing formatted output and reading keyboard input",
            "Variables, conditionals (if / else), and loops (while, for)",
            "Working with arrays, lists, or vectors",
            "Custom classes, structs, or objects",
            "Basic functions and methods",
            "Standard random-number utilities"
          ]
        },
        {
          "type": "paragraph",
          "text": "This project is tailored specifically for beginners, guiding you step by step through every function and concept with clean, readable code."
        }
      ]
    },
    {
      "id": "blackjack-source-page-04",
      "sourcePageStart": 4,
      "sourcePageEnd": 4,
      "sourcePages": [
        4
      ],
      "title": "1.2 Starting with Small Steps",
      "kind": "task",
      "checkpointIndex": 0,
      "checkpointId": "blackjack-task-1",
      "taskId": "blackjack-task-1",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "First Steps into Code: The Welcome Banner"
        },
        {
          "type": "paragraph",
          "text": "Every software project begins with a single step. Before constructing complex card evaluation algorithms or turn-based loops, we first establish our project entry file and verify that our execution environment is properly configured."
        },
        {
          "type": "paragraph",
          "text": "To do this, we create our entry point and print a clean welcome banner to confirm that the environment is operational."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 1 — Create the entry file and print welcome message"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Create your project entry file and implement print_welcome() (or printWelcome()):"
        },
        {
          "type": "paragraph",
          "text": "Think of laying down a green velvet table felt before dealing the opening hand."
        },
        {
          "type": "paragraph",
          "text": "Goal: Establish the execution root and prepare the script environment."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Entry File Setup☐  Create your project file (Blackjack.py, Blackjack.cpp, or Blackjack.java) and import required system modules."
        },
        {
          "type": "paragraph",
          "text": "Think of a dealer welcoming a guest to the table."
        },
        {
          "type": "paragraph",
          "text": "Goal: Provide immediate visual confirmation that the application is running."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Welcome Banner Output☐  Print the welcome message string: \"Welcome to Blackjack!\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Welcome to Blackjack!"
        }
      ]
    },
    {
      "id": "blackjack-source-page-05",
      "sourcePageStart": 5,
      "sourcePageEnd": 5,
      "sourcePages": [
        5
      ],
      "title": "Milestone Checkpoint: Environment Operational & Greeting Verified!",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established the project entry point:"
        },
        {
          "type": "paragraph",
          "text": "☑  Entry File Created: Initialized the project source file and confirmed compiler execution."
        },
        {
          "type": "paragraph",
          "text": "☑  Greeting Banner Verified: Successfully printed the welcome banner to the terminal."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call print_welcome() (or printWelcome()) directly from your main execution block. Verify that \"Welcome to Blackjack!\" prints cleanly to the console."
        }
      ]
    },
    {
      "id": "blackjack-source-page-06",
      "sourcePageStart": 6,
      "sourcePageEnd": 6,
      "sourcePages": [
        6
      ],
      "title": "Standard Card Anatomy & Deck Boundaries",
      "kind": "task",
      "checkpointIndex": 1,
      "checkpointId": "blackjack-task-2",
      "taskId": "blackjack-task-2",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A standard deck of French playing cards consists of 52 unique cards organized into 4 suits and 13 ranks per suit. Rather than hardcoding string literals throughout card generation functions, professional developers define these sets as immutable global constants at the top of the file."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Defining RANKS and SUITS centrally guarantees uniform string formatting across cards and eliminates spelling mismatches."
        },
        {
          "type": "table",
          "columns": [
            "Constant",
            "Elements / Value",
            "Purpose"
          ],
          "rows": [
            [
              "RANKS",
              "[\"2\", \"3\", \"4\", \"5\", \"6\", \"7\", \"8\", \"9\", \"10\", \"Jack\", \"Queen\", \"King\", \"Ace\"]",
              "The 13 canonical card face values in ascending order"
            ],
            [
              "SUITS",
              "[\"Hearts\", \"Diamonds\", \"Clubs\", \"Spades\"]",
              "The 4 standard suits of a French deck"
            ]
          ]
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 2 — Define standard ranks and suits constants"
        },
        {
          "type": "paragraph",
          "text": "Declare the global constants for ranks and suits:"
        },
        {
          "type": "paragraph",
          "text": "Think of stocking a casino storage closet with fresh packs containing every official card type."
        },
        {
          "type": "paragraph",
          "text": "Goal: Define the 13 canonical rank names from 2 up through Ace."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Declare Rank Collection☐  Declare constant list RANKS containing strings: \"2\", \"3\", \"4\", \"5\", \"6\", \"7\", \"8\", \"9\", \"10\", \"Jack\", \"Queen\", \"King\", \"Ace\"."
        },
        {
          "type": "paragraph",
          "text": "Think of sorting the four traditional French card families."
        },
        {
          "type": "paragraph",
          "text": "Goal: Define the 4 standard suit categories."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Declare Suit Collection☐  Declare constant list SUITS containing strings: \"Hearts\", \"Diamonds\", \"Clubs\", \"Spades\"."
        }
      ]
    },
    {
      "id": "blackjack-source-page-07",
      "sourcePageStart": 7,
      "sourcePageEnd": 7,
      "sourcePages": [
        7
      ],
      "title": "Milestone Checkpoint: Card Configuration Constants Configured!",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established the card dimensions and categories:"
        },
        {
          "type": "paragraph",
          "text": "☑  Ranks Registered: Configured 13 canonical ranks from 2 to Ace."
        },
        {
          "type": "paragraph",
          "text": "☑  Suits Registered: Configured the 4 standard card suits."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Print the lengths of RANKS and SUITS. Verify that len(RANKS) == 13 and len(SUITS) == 4."
        }
      ]
    },
    {
      "id": "blackjack-source-page-08",
      "sourcePageStart": 8,
      "sourcePageEnd": 8,
      "sourcePages": [
        8
      ],
      "title": "Chapter 2: Rules & Design Plan",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "2.1 Understanding the Game"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Blackjack Mechanics & Point Scoring"
        },
        {
          "type": "paragraph",
          "text": "Blackjack (also known as Twenty-One) is a card comparison game between a Player and a Dealer. Both participants strive to assemble a hand whose total point value is as close to 21 as possible without exceeding it."
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Number Cards (2 through 10): Worth their exact numerical face value.",
            "Face Cards (Jack, Queen, King): Each worth 10 points.",
            "Aces: Worth 11 points or 1 point. An Ace initially counts as 11, but if the hand total exceeds 21, the Ace automatically converts to 1 point so the hand does not bust.",
            "Busting: If a hand total exceeds 21 points, that participant has busted and loses immediately.",
            "Natural Blackjack: An opening two-card hand totaling exactly 21 (an Ace paired with any 10-point card).",
            "The Dealer House Rule: Unlike the Player who makes strategic choices to Hit or Stand, the Dealer must strictly follow fixed casino rules: hit until the hand total reaches at least 17, and then stand."
          ]
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Card Values Summary"
        },
        {
          "type": "table",
          "columns": [
            "Card Rank",
            "Point Value",
            "Special Rule"
          ],
          "rows": [
            [
              "2 through 10",
              "2 through 10 (Face Value)",
              "Exact numerical value added to total"
            ],
            [
              "Jack, Queen, King",
              "10 Points Each",
              "Standard 10-value face cards"
            ],
            [
              "Ace",
              "11 or 1 Point",
              "Starts as 11; drops to 1 automatically if total exceeds 21"
            ]
          ]
        }
      ]
    },
    {
      "id": "blackjack-source-page-09",
      "sourcePageStart": 9,
      "sourcePageEnd": 9,
      "sourcePages": [
        9
      ],
      "title": "2.2 Planning the Game",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Chronological Execution Flow"
        },
        {
          "type": "paragraph",
          "text": "A complete Blackjack round progresses through 6 distinct stages from initial shuffle to final session recap:"
        },
        {
          "type": "paragraph",
          "text": "/"
        },
        {
          "type": "image",
          "src": "/assets/projects/guides/blackjack/image1.png",
          "alt": "Blackjack game flow diagram",
          "caption": "Blackjack game flow diagram"
        }
      ]
    },
    {
      "id": "blackjack-source-page-10",
      "sourcePageStart": 10,
      "sourcePageEnd": 10,
      "sourcePages": [
        10
      ],
      "title": "2.3 System Architecture: Thinking in OOP (Component Responsibility Table)",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Structuring our code into clean, single-responsibility components keeps our architecture modular and testable:"
        },
        {
          "type": "table",
          "columns": [
            "Component",
            "Responsibility"
          ],
          "rows": [
            [
              "Card",
              "Encapsulates a single card's rank and suit, providing a clean descriptive string."
            ],
            [
              "Deck Utilities",
              "Pure functions to generate 52 unique cards (createDeck), shuffle them (shuffleDeck), and draw (dealCard)."
            ],
            [
              "Scoring Engine",
              "Evaluates any collection of cards (calculateScore), handling dynamic Ace reduction (11 to 1)."
            ],
            [
              "Board Display",
              "Renders hands to the terminal (displayHand), masking the Dealer's hole card during active play."
            ],
            [
              "Turn Controllers",
              "Prompts the player for action (getPlayerChoice) and drives automated dealer drawing (playDealerTurn)."
            ],
            [
              "Referee",
              "Evaluates final totals, determines winners, and prints summary banners (determineOutcome)."
            ],
            [
              "BlackjackGame",
              "Coordinates the full session lifecycle, tracks cumulative wins/losses/ties, and manages replay."
            ]
          ]
        }
      ]
    },
    {
      "id": "blackjack-source-page-11",
      "sourcePageStart": 11,
      "sourcePageEnd": 11,
      "sourcePages": [
        11
      ],
      "title": "Chapter 3: Cards & Deck Architecture",
      "kind": "task",
      "checkpointIndex": 2,
      "checkpointId": "blackjack-task-3",
      "taskId": "blackjack-task-3",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "3.1 Modeling Playing Cards"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "State Encapsulation: The Card Model"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "In an object-oriented design, an individual playing card is an autonomous domain entity. It holds two immutable attributes: its rank (e.g., \"Ace\", \"10\") and its suit (e.g., \"Spades\", \"Hearts\")."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "By implementing a standardized string conversion method (__str__ in Python, toString() in C++ and Java), any card can format itself as human-readable text (such as \"Ace of Spades\"), keeping presentation logic clean."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 3 — Create the Card class"
        },
        {
          "type": "code",
          "code": "Create the Card class with rank and suit attributes:"
        },
        {
          "type": "paragraph",
          "text": "Think of printing an individual physical playing card with its rank number and suit symbol."
        },
        {
          "type": "paragraph",
          "text": "Goal: Store the card's rank and suit upon creation."
        },
        {
          "type": "code",
          "code": "STEP 1 — Initialize Card Rank and Suit☐  Define class Card with constructor taking rank and suit and assigning them to instance attributes."
        },
        {
          "type": "paragraph",
          "text": "Think of a player reading the card out loud during a game."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Format the card as \"<rank> of <suit>\"."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Format Card Description☐  Implement string representation returning \"<rank> of <suit>\" (e.g., \"Ace of Spades\")."
        }
      ]
    },
    {
      "id": "blackjack-source-page-12",
      "sourcePageStart": 12,
      "sourcePageEnd": 12,
      "sourcePages": [
        12
      ],
      "title": "Milestone Checkpoint: Card Entity Model Verified!",
      "kind": "information",
      "checkpointIndex": 2,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established the card domain entity:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Attributes Stored: Initialized rank and suit fields."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  String Conversion Verified: Implemented clean toString() / __str__() formatting."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate c = Card(\"King\", \"Diamonds\"). Verify that printing c yields \"King of Diamonds\"."
        }
      ]
    },
    {
      "id": "blackjack-source-page-13",
      "sourcePageStart": 13,
      "sourcePageEnd": 13,
      "sourcePages": [
        13
      ],
      "title": "3.2 Deck Generation & Manipulation",
      "kind": "task",
      "checkpointIndex": 3,
      "checkpointId": "blackjack-task-4",
      "taskId": "blackjack-task-4",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Cartesian Product: Populating 52 Unique Cards"
        },
        {
          "type": "paragraph",
          "text": "A complete French deck is formed by taking the Cartesian product of the 4 suits and the 13 ranks (4 * 13 = 52 cards)."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "We use nested iterative loops: the outer loop iterates over each suit in SUITS, while the inner loop iterates over each rank in RANKS. For each pair, a new Card instance is created and appended to the collection."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 4 — Create and populate the 52-card deck"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement create_deck() (or createDeck()):"
        },
        {
          "type": "paragraph",
          "text": "Think of opening a brand new, empty card box."
        },
        {
          "type": "paragraph",
          "text": "Goal: Allocate an empty collection to hold 52 card entities."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Initialize Empty Deck Collection☐  Initialize an empty list or vector deck."
        },
        {
          "type": "paragraph",
          "text": "Think of a card factory printing all 13 cards for each of the 4 suits."
        },
        {
          "type": "paragraph",
          "text": "Goal: Instantiate all 52 unique card combinations."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Populate Combinations with Nested Loops☐  Loop over each suit in SUITS, and inside loop over each rank in RANKS, creating and appending Card(rank, suit)."
        },
        {
          "type": "paragraph",
          "text": "Think of closing the box and handing the complete deck to the dealer."
        },
        {
          "type": "paragraph",
          "text": "Goal: Return the populated 52-card collection."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Return Completed Deck☐  Return the completed deck collection."
        }
      ]
    },
    {
      "id": "blackjack-source-page-14",
      "sourcePageStart": 14,
      "sourcePageEnd": 14,
      "sourcePages": [
        14
      ],
      "title": "Milestone Checkpoint: Deck Generation Operational!",
      "kind": "information",
      "checkpointIndex": 3,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented complete 52-card deck generation:"
        },
        {
          "type": "paragraph",
          "text": "☑  Nested Iteration Complete: Traversed all 4 suits and 13 ranks."
        },
        {
          "type": "paragraph",
          "text": "☑  Exact Card Count: Verified that 52 unique cards are created."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call d = create_deck(). Verify that len(d) == 52 and that d[0] and d[-1] are valid cards."
        }
      ]
    },
    {
      "id": "blackjack-source-page-15",
      "sourcePageStart": 15,
      "sourcePageEnd": 15,
      "sourcePages": [
        15
      ],
      "title": "Random Permutation: Shuffling the Shoe",
      "kind": "task",
      "checkpointIndex": 4,
      "checkpointId": "blackjack-task-5",
      "taskId": "blackjack-task-5",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A freshly manufactured deck is arranged in strict sequential order. Before any cards are dealt, the deck must be thoroughly randomized so outcomes are fair and unpredictable."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "In modern standard libraries, this is accomplished via the Fisher-Yates shuffle algorithm (built into random.shuffle() in Python, Collections.shuffle() in Java, or an in-place swap loop in C++)."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 5 — Shuffle the deck"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement shuffle_deck(deck) (or shuffleDeck(deck)):"
        },
        {
          "type": "paragraph",
          "text": "Think of placing the fresh deck onto the table ready for mixing."
        },
        {
          "type": "paragraph",
          "text": "Goal: Accept the deck collection as a mutable parameter."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Receive Deck Reference☐  Define shuffle_deck(deck) accepting the deck collection."
        },
        {
          "type": "paragraph",
          "text": "Think of a casino dealer performing a riffle shuffle to randomize the order."
        },
        {
          "type": "paragraph",
          "text": "Goal: Randomly permute the cards in-place."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Randomize Card Positions in Place☐  Use standard randomization utilities to shuffle the elements of deck in-place."
        }
      ]
    },
    {
      "id": "blackjack-source-page-16",
      "sourcePageStart": 16,
      "sourcePageEnd": 16,
      "sourcePages": [
        16
      ],
      "title": "Milestone Checkpoint: Random Deck Shuffler Verified!",
      "kind": "information",
      "checkpointIndex": 4,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented deck randomization:"
        },
        {
          "type": "paragraph",
          "text": "☑  In-Place Permutation: Shuffled cards thoroughly without duplicating elements."
        },
        {
          "type": "paragraph",
          "text": "☑  Non-Deterministic Order: Confirmed different card sequences across repeated shuffles."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Create a deck, record its first card, call shuffle_deck(deck), and verify the order has changed."
        }
      ]
    },
    {
      "id": "blackjack-source-page-17",
      "sourcePageStart": 17,
      "sourcePageEnd": 17,
      "sourcePages": [
        17
      ],
      "title": "The Deal: Drawing from the Top of the Deck",
      "kind": "task",
      "checkpointIndex": 5,
      "checkpointId": "blackjack-task-6",
      "taskId": "blackjack-task-6",
      "blocks": [
        {
          "type": "paragraph",
          "text": "In a physical game, cards are dealt one by one from the top of the deck. In programming collections, drawing from the top or back of a list is an efficient $O(1)$ pop operation that removes the item and returns it."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 6 — Deal a card from the deck"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement deal_card(deck) (or dealCard(deck)):"
        },
        {
          "type": "paragraph",
          "text": "Think of taking the top card off the deck shoe."
        },
        {
          "type": "paragraph",
          "text": "Goal: Remove the last element from the collection."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Extract Top Card from Collection☐  Remove the card from the top (end) of deck using a pop or remove operation."
        },
        {
          "type": "paragraph",
          "text": "Think of sliding the drawn card across the table to the participant."
        },
        {
          "type": "paragraph",
          "text": "Goal: Return the removed card to the caller."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Return Dealt Card☐  Return the extracted Card object."
        }
      ]
    },
    {
      "id": "blackjack-source-page-18",
      "sourcePageStart": 18,
      "sourcePageEnd": 18,
      "sourcePages": [
        18
      ],
      "title": "Milestone Checkpoint: Card Dealing Mechanic Functional!",
      "kind": "information",
      "checkpointIndex": 5,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have verified the card dealing operation:"
        },
        {
          "type": "paragraph",
          "text": "☑  Collection Shrinkage: Confirmed deck size decrements by 1 on every deal."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Valid Entity Returned: Returned an authentic Card object."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Create a deck of 52 cards, call card = deal_card(deck), and confirm len(deck) == 51 and card is a Card."
        }
      ]
    },
    {
      "id": "blackjack-source-page-19",
      "sourcePageStart": 19,
      "sourcePageEnd": 19,
      "sourcePages": [
        19
      ],
      "title": "Chapter 4: Scoring Engine & Hand Visualization",
      "kind": "task",
      "checkpointIndex": 6,
      "checkpointId": "blackjack-task-7",
      "taskId": "blackjack-task-7",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "4.1 Dynamic Score Calculation"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "The Dual-Value Ace Dilemma (Dynamic Downgrading)"
        },
        {
          "type": "paragraph",
          "text": "Blackjack scoring introduces a unique computational challenge: the Ace."
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Number cards (2–10) have static values.",
            "Face cards (Jack, Queen, King) are worth 10 points.",
            "An Ace is preferentially worth 11 points. However, if counting an Ace as 11 causes the hand total to exceed 21, the Ace must dynamically downgrade to 1 point (reducing the total by 10) to keep the player from busting."
          ]
        },
        {
          "type": "paragraph",
          "text": "The algorithm sums all cards while counting how many Aces are present. If the total exceeds 21 and at least one Ace is available, the algorithm subtracts 10 and decrements the Ace counter, repeating this check until the total is $\\le 21$ or all Aces have been converted to 1."
        },
        {
          "type": "paragraph",
          "text": "Initial Cards: [Ace of Spades, 8 of Hearts, 5 of Clubs]\n1. Initial Sum:  11 + 8 + 5 = 24  (Aces counted as 11: 1)\n2. Total > 21 and Aces > 0:\n   Subtract 10 -> Total becomes 14 (Ace converted to 1: 0 remaining)\n3. Final Score: 14 (Hand remains alive!)"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 7 — Calculate hand value with automatic Ace adjustment"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement calculate_score(hand) (or calculateScore(hand)):"
        },
        {
          "type": "paragraph",
          "text": "Think of setting up a scorekeeper's notepad with zero points and an empty tally for Aces."
        },
        {
          "type": "paragraph",
          "text": "Goal: Initialize accumulators for point total and available Aces."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Initialize Point Accumulator and Ace Counter☐  Initialize total = 0 and ace_count = 0."
        },
        {
          "type": "paragraph",
          "text": "Think of adding each card's maximum point potential to your preliminary score."
        },
        {
          "type": "paragraph",
          "text": "Goal: Sum fixed values (face cards as 10, numbers as integers, Aces as 11)."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Accumulate Card Values and Count Aces☐  Iterate through hand: if rank is Jack, Queen, or King, add 10; if Ace, add 11 and increment ace_count; otherwise add the rank's integer value."
        },
        {
          "type": "paragraph",
          "text": "Think of flipping an Ace over to its alternate 1-point side whenever the score threatens to bust."
        },
        {
          "type": "paragraph",
          "text": "Goal: Downgrade Aces from 11 to 1 while total exceeds 21."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Dynamically Downgrade Aces to Avoid Busting☐  Run a loop while total > 21 and ace_count > 0: subtract 10 from total and decrement ace_count by 1."
        },
        {
          "type": "paragraph",
          "text": "Think of announcing the finalized hand total to the table."
        },
        {
          "type": "paragraph",
          "text": "Goal: Return the optimized integer score."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Return Calculated Hand Score☐  Return the computed integer total."
        }
      ]
    },
    {
      "id": "blackjack-source-page-20",
      "sourcePageStart": 20,
      "sourcePageEnd": 20,
      "sourcePages": [
        20
      ],
      "title": "Milestone Checkpoint: Dynamic Ace Scoring Engine Complete!",
      "kind": "information",
      "checkpointIndex": 6,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented dynamic hand calculation:"
        },
        {
          "type": "paragraph",
          "text": "☑  Face Card Handling: Accurately evaluated 10, Jack, Queen, and King as 10 points."
        },
        {
          "type": "paragraph",
          "text": "☑  Dynamic Ace Adjustment: Handled single and multiple Aces converting from 11 to 1 when exceeding 21."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Test calculate_score([Card(\"Ace\", \"Spades\"), Card(\"9\", \"Hearts\")]) -> returns 20."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Test calculate_score([Card(\"Ace\", \"Spades\"), Card(\"9\", \"Hearts\"), Card(\"5\", \"Clubs\")]) -> returns 15."
        }
      ]
    },
    {
      "id": "blackjack-source-page-21",
      "sourcePageStart": 21,
      "sourcePageEnd": 21,
      "sourcePages": [
        21
      ],
      "title": "4.2 Hand Visualization & Information Masking",
      "kind": "task",
      "checkpointIndex": 7,
      "checkpointId": "blackjack-task-8",
      "taskId": "blackjack-task-8",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Managing Imperfect Information: Revealed vs Hidden Cards"
        },
        {
          "type": "paragraph",
          "text": "A crucial element of authentic Blackjack is imperfect information. On the opening deal:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "The Player's cards are both face up.",
            "The Dealer receives one card face up (the upcard) and one card face down (the hole card)."
          ]
        },
        {
          "type": "heading",
          "level": 3,
          "text": "The game presentation must support a hide_first_card flag. When true, the first card is obscured as [Hidden Card], and the hand score is not disclosed. When false, all cards and the accurate point total are rendered cleanly."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 8 — Display hands with hidden hole card support"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement display_hand(owner_name, hand, hide_first_card=False):"
        },
        {
          "type": "paragraph",
          "text": "Think of checking whether the casino rules mandate keeping the dealer's first card facedown."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Branch rendering behavior based on the hide_first_card parameter."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Check Hole Card Masking Flag☐  Check if hide_first_card is True."
        },
        {
          "type": "paragraph",
          "text": "Think of leaving the dealer's first card face down on the felt while showing the second card."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print the masked representation for the dealer's opening hand."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Render Masked Hand for Dealer☐  When hidden, print \"<owner_name>'s Hand: [Hidden Card], <hand[1]>\" without displaying a score total."
        },
        {
          "type": "paragraph",
          "text": "Think of spreading all cards open for everyone to see alongside the verified total score."
        },
        {
          "type": "paragraph",
          "text": "Goal: Format and print all cards joined by commas with the hand's score total."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Render Formatted Visible Hand with Score☐  When not hidden, calculate the score using calculate_score(hand), format all card descriptions separated by commas, and print: \"<owner_name>'s Hand (<score>): <cards>\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Dealer's Hand: [Hidden Card], 6 of Diamonds\nPlayer's Hand (20): King of Hearts, 10 of Diamonds"
        }
      ]
    },
    {
      "id": "blackjack-source-page-22",
      "sourcePageStart": 22,
      "sourcePageEnd": 22,
      "sourcePages": [
        22
      ],
      "title": "Milestone Checkpoint: Hand Visualization Verified!",
      "kind": "information",
      "checkpointIndex": 7,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented board and hand presentation:"
        },
        {
          "type": "paragraph",
          "text": "☑  Hole Card Masking: Successfully disguised the Dealer's first card during active rounds."
        },
        {
          "type": "paragraph",
          "text": "☑  Open Card Formatting: Rendered full card inventories with accurate point calculations."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Create a hand with 2 cards. Call display_hand(\"Dealer\", hand, hide_first_card=True) and verify [Hidden Card] is displayed. Call again with hide_first_card=False and verify both cards and the score are displayed."
        }
      ]
    },
    {
      "id": "blackjack-source-page-23",
      "sourcePageStart": 23,
      "sourcePageEnd": 23,
      "sourcePages": [
        23
      ],
      "title": "Chapter 5: Turn Controllers & Referee Engine",
      "kind": "task",
      "checkpointIndex": 8,
      "checkpointId": "blackjack-task-9",
      "taskId": "blackjack-task-9",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "5.1 Player Turn Controller"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Defensive Programming: Hit or Stand CLI Prompting"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "During their turn, a player decides whether to Hit (draw another card) or Stand (keep their current hand). Because users may type uppercase letters, full words (\"hit\"), or accidental spaces, robust input validation is required."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "The prompt loop must defensively sanitize inputs, accept valid abbreviations (\"h\", \"hit\", \"s\", \"stand\"), and politely re-prompt on invalid entries without crashing."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 9 — Prompt and validate Player choice (Hit or Stand)"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement get_player_choice():"
        },
        {
          "type": "paragraph",
          "text": "Think of asking a casino patron for their decision while keeping the table open."
        },
        {
          "type": "paragraph",
          "text": "Goal: Drive a continuous prompt loop until valid input is received."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Interactive Input Prompt Loop☐  Construct a while True loop prompting the player: \"\\nWould you like to (H)it or (S)tand? \"."
        },
        {
          "type": "paragraph",
          "text": "Think of clearing away stray chips and clarifying what the player said."
        },
        {
          "type": "paragraph",
          "text": "Goal: Trim whitespace and convert the input to lowercase."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Clean and Normalize Input☐  Sanitize the raw input string by trimming leading/trailing whitespace and lowercasing it."
        },
        {
          "type": "paragraph",
          "text": "Think of a dealer acknowledging the signal or asking the player to repeat clearly."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Return 'h' or 's', or print an error message and re-prompt."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Evaluate Valid Choice or Re-prompt☐  If choice is \"h\" or \"hit\", return \"h\". If choice is \"s\" or \"stand\", return \"s\". Otherwise print \"Invalid input. Please enter 'h' to hit or 's' to stand.\" and continue."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Would you like to (H)it or (S)tand? hit"
        }
      ]
    },
    {
      "id": "blackjack-source-page-24",
      "sourcePageStart": 24,
      "sourcePageEnd": 24,
      "sourcePages": [
        24
      ],
      "title": "Milestone Checkpoint: Defensive Player Input Operational!",
      "kind": "information",
      "checkpointIndex": 8,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established safe player input validation:"
        },
        {
          "type": "paragraph",
          "text": "☑  Sanitized Inputs: Trimmed whitespace and tolerated case variations."
        },
        {
          "type": "paragraph",
          "text": "☑  Defensive Re-prompting: Handled invalid entries gracefully with informative guidance."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call choice = get_player_choice(), test typing invalid inputs like abc followed by h, and verify the function re-prompts and eventually returns 'h'."
        }
      ]
    },
    {
      "id": "blackjack-source-page-25",
      "sourcePageStart": 25,
      "sourcePageEnd": 25,
      "sourcePages": [
        25
      ],
      "title": "5.2 Automated Dealer House AI",
      "kind": "task",
      "checkpointIndex": 9,
      "checkpointId": "blackjack-task-10",
      "taskId": "blackjack-task-10",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Automating the Casino Dealer: The 17+ Fixed Rule"
        },
        {
          "type": "paragraph",
          "text": "Unlike a human player, a casino dealer exercises zero personal judgment. The dealer must adhere to a deterministic algorithm:"
        },
        {
          "type": "paragraph",
          "text": "1.  Reveal the hidden hole card."
        },
        {
          "type": "paragraph",
          "text": "2.  While the dealer's hand total is strictly less than 17, the dealer must hit (draw a card)."
        },
        {
          "type": "paragraph",
          "text": "3.  Once the dealer's hand total reaches 17 or higher, the dealer must stand."
        },
        {
          "type": "paragraph",
          "text": "4.  If the dealer's total exceeds 21, the dealer busts."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 10 — Execute Dealer's automated turn"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement play_dealer_turn(deck, dealer_hand):"
        },
        {
          "type": "paragraph",
          "text": "Think of the dealer turning over their hidden hole card for the entire table to see."
        },
        {
          "type": "paragraph",
          "text": "Goal: Announce the start of the dealer's turn and reveal both cards."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Announce Dealer Turn and Reveal Hole Card☐  Print \"\\n--- Dealer's Turn ---\" and call display_hand(\"Dealer\", dealer_hand, hide_first_card=False)."
        },
        {
          "type": "paragraph",
          "text": "Think of the house rule requiring the dealer to take cards as long as their score is under 17."
        },
        {
          "type": "paragraph",
          "text": "Goal: Maintain an automated drawing loop while score is below 17."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Automated Hit Loop While Score Under 17☐  While calculate_score(dealer_hand) < 17, continue drawing cards."
        },
        {
          "type": "paragraph",
          "text": "Think of the dealer pulling another card from the shoe and announcing it to the table."
        },
        {
          "type": "paragraph",
          "text": "Goal: Draw a card, append it to the hand, and render the updated hand state."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Draw Card, Announce Draw, and Refresh Display☐  Inside the loop: deal a card using deal_card(deck), append it to dealer_hand, print \"Dealer hits and draws: <card>\", and call display_hand(\"Dealer\", dealer_hand, hide_first_card=False)."
        },
        {
          "type": "paragraph",
          "text": "Think of the dealer tapping the table to signal standing, or acknowledging a bust."
        },
        {
          "type": "paragraph",
          "text": "Goal: Announce whether the dealer stood or busted."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Evaluate and Announce Dealer Stand or Bust☐  After the loop, calculate score: if score > 21, print \"Dealer busted!\"; otherwise print \"Dealer stands with <score>.\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "--- Dealer's Turn ---\nDealer's Hand (16): Queen of Hearts, 6 of Diamonds\nDealer hits and draws: Queen of Spades\nDealer's Hand (26): Queen of Hearts, 6 of Diamonds, Queen of Spades\nDealer busted!"
        }
      ]
    },
    {
      "id": "blackjack-source-page-26",
      "sourcePageStart": 26,
      "sourcePageEnd": 26,
      "sourcePages": [
        26
      ],
      "title": "Milestone Checkpoint: Dealer Automated AI Operational!",
      "kind": "information",
      "checkpointIndex": 9,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented automated casino house rules:"
        },
        {
          "type": "paragraph",
          "text": "☑  Hole Card Revealed: Correctly showed the full dealer hand at the start of the turn."
        },
        {
          "type": "paragraph",
          "text": "☑  Threshold Enforced: Hit continuously while under 17 and stood at 17 or higher."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Set up a deck and a dealer hand with cards totaling 12. Run play_dealer_turn(deck, dealer_hand) and verify that cards are drawn until total is $\\ge 17$."
        }
      ]
    },
    {
      "id": "blackjack-source-page-27",
      "sourcePageStart": 27,
      "sourcePageEnd": 27,
      "sourcePages": [
        27
      ],
      "title": "5.3 Outcome Determination",
      "kind": "task",
      "checkpointIndex": 10,
      "checkpointId": "blackjack-task-11",
      "taskId": "blackjack-task-11",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "The Referee Engine: Decision Hierarchy & Tie Resolution"
        },
        {
          "type": "paragraph",
          "text": "Once both participants conclude their turns, the round referee evaluates both hands according to standard Blackjack rules:"
        },
        {
          "type": "paragraph",
          "text": "1.  Player Bust: If player score > 21, the Player loses immediately (Dealer wins)."
        },
        {
          "type": "paragraph",
          "text": "2.  Dealer Bust: If dealer score > 21 (and player did not bust), the Player wins."
        },
        {
          "type": "paragraph",
          "text": "3.  Player Higher Score: If player score > dealer score, the Player wins."
        },
        {
          "type": "paragraph",
          "text": "4.  Dealer Higher Score: If dealer score > player score, the Dealer wins."
        },
        {
          "type": "paragraph",
          "text": "5.  Equal Scores: If both totals are equal, the round is a push (tie), with neither side winning."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 11 — Determine and announce round outcome"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement determine_outcome(player_hand, dealer_hand):"
        },
        {
          "type": "paragraph",
          "text": "Think of the referee laying both hands side by side on the table for all players to inspect."
        },
        {
          "type": "paragraph",
          "text": "Goal: Calculate final point totals and render a clear summary header."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Calculate Final Scores and Display Matchup Summary☐  Compute player_score and dealer_score, print \"\\n===== ROUND RESULT =====\", and call display_hand() for both Player and Dealer."
        },
        {
          "type": "paragraph",
          "text": "Think of penalizing a player who exceeded the 21-point threshold."
        },
        {
          "type": "paragraph",
          "text": "Goal: Award victory to the Dealer if the Player busted."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Check Player Bust Condition☐  If player_score > 21, print \"\\nDealer wins! You went over 21.\" and return \"dealer\"."
        },
        {
          "type": "paragraph",
          "text": "Think of celebrating when the casino dealer busts after taking too many cards."
        },
        {
          "type": "paragraph",
          "text": "Goal: Award victory to the Player if the Dealer busted."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Check Dealer Bust Condition☐  Else if dealer_score > 21, print \"\\nYou win! Dealer went over 21.\" and return \"player\"."
        },
        {
          "type": "paragraph",
          "text": "Think of comparing point totals on an official scorecard to find who came closer to 21."
        },
        {
          "type": "paragraph",
          "text": "Goal: Award victory to the higher score or declare a push on equal points."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Compare Final Hand Scores and Announce Result☐  If player_score > dealer_score, print victory message and return \"player\"; if dealer_score > player_score, print defeat message and return \"dealer\"; otherwise print push message."
        },
        {
          "type": "paragraph",
          "text": "Think of returning the outcome code to the session scoreboard manager."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Return 'tie' when neither player nor dealer had a higher score."
        },
        {
          "type": "paragraph",
          "text": "STEP 5 — Return Standard Outcome Identifier☐  Return canonical string identifier: \"player\", \"dealer\", or \"tie\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "===== ROUND RESULT =====\nPlayer's Hand (20): King of Hearts, 10 of Diamonds\nDealer's Hand (26): Queen of Hearts, 6 of Diamonds, Queen of Spades\n\nYou win! Dealer went over 21."
        }
      ]
    },
    {
      "id": "blackjack-source-page-28",
      "sourcePageStart": 28,
      "sourcePageEnd": 28,
      "sourcePages": [
        28
      ],
      "title": "Source page 28",
      "kind": "information",
      "checkpointIndex": 10,
      "checkpointId": null,
      "taskId": null,
      "blocks": []
    },
    {
      "id": "blackjack-source-page-29",
      "sourcePageStart": 29,
      "sourcePageEnd": 29,
      "sourcePages": [
        29
      ],
      "title": "Milestone Checkpoint: Outcome Determination Engine Verified!",
      "kind": "information",
      "checkpointIndex": 10,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed the outcome evaluation engine:"
        },
        {
          "type": "paragraph",
          "text": "☑  Bust Detection: Prioritized player and dealer bust conditions accurately."
        },
        {
          "type": "paragraph",
          "text": "☑  Point Comparison: Handled winning, losing, and push outcomes cleanly."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Test determine_outcome with player hand of 20 and dealer hand of 18 -> verifies \"player\". Test player hand of 19 and dealer hand of 19 -> verifies \"tie\"."
        }
      ]
    },
    {
      "id": "blackjack-source-page-30",
      "sourcePageStart": 30,
      "sourcePageEnd": 30,
      "sourcePages": [
        30
      ],
      "title": "Chapter 6: Session Management & Application Assembly",
      "kind": "task",
      "checkpointIndex": 11,
      "checkpointId": "blackjack-task-12",
      "taskId": "blackjack-task-12",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "6.1 Session Scoreboard"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Cumulative Session Tracking: Wins, Losses, and Ties"
        },
        {
          "type": "paragraph",
          "text": "A great casino game does not close after a single hand. Players want to track their performance across an entire session. A clean scoreboard display presents cumulative stats after each round, reinforcing visual feedback."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 12 — Manage and display session scoreboard"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement display_scoreboard(player_wins, dealer_wins, ties):"
        },
        {
          "type": "paragraph",
          "text": "Think of drawing a neat scoreboard box above the dealer station."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print a visual divider separating the scoreboard from gameplay logs."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Format Scoreboard Card Border☐  Print a formatted horizontal border line: \"\\n------------------------------------\"."
        },
        {
          "type": "paragraph",
          "text": "Think of updating the numbers on the stadium scoreboard."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print the current count of Player wins, Dealer wins, and Ties."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Print Cumulative Tally Line☐  Print f\"SCOREBOARD: Player: {player_wins} | Dealer: {dealer_wins} | Ties: {ties}\" followed by the closing border."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "------------------------------------\nSCOREBOARD: Player: 1 | Dealer: 0 | Ties: 0\n------------------------------------"
        }
      ]
    },
    {
      "id": "blackjack-source-page-31",
      "sourcePageStart": 31,
      "sourcePageEnd": 31,
      "sourcePages": [
        31
      ],
      "title": "Milestone Checkpoint: Session Scoreboard Operational!",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented session performance tracking:"
        },
        {
          "type": "paragraph",
          "text": "☑  Visual Framing: Rendered clean borders around the session statistics."
        },
        {
          "type": "paragraph",
          "text": "☑  Three-Way Metric: Formatted Player wins, Dealer wins, and Ties in a single line."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call display_scoreboard(3, 2, 1). Verify the formatted line prints cleanly."
        }
      ]
    },
    {
      "id": "blackjack-source-page-32",
      "sourcePageStart": 32,
      "sourcePageEnd": 32,
      "sourcePages": [
        32
      ],
      "title": "6.2 Round Orchestration",
      "kind": "task",
      "checkpointIndex": 12,
      "checkpointId": "blackjack-task-13",
      "taskId": "blackjack-task-13",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "System Coordination: The BlackjackGame Controller Skeleton"
        },
        {
          "type": "code",
          "code": "The BlackjackGame class acts as the central coordinator. It maintains the session counters (player_wins, dealer_wins, ties) and executes the step-by-step lifecycle of an individual round:"
        },
        {
          "type": "paragraph",
          "text": "1.  Deal 2 cards to each participant."
        },
        {
          "type": "paragraph",
          "text": "2.  Check for opening natural Blackjack (21 on deal)."
        },
        {
          "type": "paragraph",
          "text": "3.  Run the player's Hit/Stand decision loop."
        },
        {
          "type": "paragraph",
          "text": "4.  If player does not bust, run the dealer's automated turn."
        },
        {
          "type": "paragraph",
          "text": "5.  Determine round outcome and update session counters."
        },
        {
          "type": "code",
          "code": "Task 13 — Create BlackjackGame class and implement playRound()"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Define BlackjackGame and implement play_round() (or playRound()):"
        },
        {
          "type": "paragraph",
          "text": "Think of sitting down at a newly opened blackjack table with a fresh ledger."
        },
        {
          "type": "paragraph",
          "text": "Goal: Initialize cumulative counters for player wins, dealer wins, and ties to zero."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Initialize Session Score Counters☐  In BlackjackGame.__init__(), initialize self.player_wins = 0, self.dealer_wins = 0, and self.ties = 0."
        },
        {
          "type": "paragraph",
          "text": "Think of the dealer taking a fresh deck, shuffling, and dealing two cards to each seat."
        },
        {
          "type": "paragraph",
          "text": "Goal: Prepare a shuffled deck and deal opening 2-card hands."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Generate, Shuffle, and Deal Opening Cards☐  In play_round(): create deck, shuffle it, and deal 2 cards to player_hand and 2 cards to dealer_hand."
        },
        {
          "type": "paragraph",
          "text": "Think of showing the player their cards while keeping the dealer's first card facedown."
        },
        {
          "type": "paragraph",
          "text": "Goal: Display opening hands with the Dealer hole card masked."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Render Opening Hands with Dealer Hole Card Masked☐  Print \"\\n===== NEW BLACKJACK ROUND =====\", call display_hand(\"Dealer\", dealer_hand, hide_first_card=True), and call display_hand(\"Player\", player_hand, hide_first_card=False)."
        },
        {
          "type": "paragraph",
          "text": "Think of immediate excitement when the opening deal totals an unbeatable 21."
        },
        {
          "type": "paragraph",
          "text": "Goal: Detect opening Blackjack, resolve the round immediately, and update scores."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Check Natural Opening Blackjack☐  If calculate_score(player_hand) == 21, print \"\\nBlackjack! You have 21!\", call determine_outcome(), update scores, and return early."
        },
        {
          "type": "paragraph",
          "text": "Think of the player tapping the table to hit or waving their hand to stand."
        },
        {
          "type": "paragraph",
          "text": "Goal: Run the Hit/Stand loop while player score is under 21."
        },
        {
          "type": "paragraph",
          "text": "STEP 5 — Execute Interactive Player Turn Loop☐  While score < 21, prompt using get_player_choice(): if 'h', deal a card, append to hand, and display hand; if 's', break loop. If score > 21, announce bust, resolve outcome, update scores, and return early."
        },
        {
          "type": "paragraph",
          "text": "Think of the dealer completing their automated turn and determining who won."
        },
        {
          "type": "paragraph",
          "text": "Goal: Execute dealer turn, evaluate winner, and update session scores."
        }
      ]
    },
    {
      "id": "blackjack-source-page-33",
      "sourcePageStart": 33,
      "sourcePageEnd": 33,
      "sourcePages": [
        33
      ],
      "title": "Expected Terminal Interaction & Output:",
      "kind": "information",
      "checkpointIndex": 12,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "expected-output",
          "output": "STEP 6 — Execute Dealer Turn and Resolve Outcome☐  Call play_dealer_turn(deck, dealer_hand), resolve outcome with determine_outcome(), and update session scores with scoreboard display."
        },
        {
          "type": "expected-output",
          "output": "===== NEW BLACKJACK ROUND =====\nDealer's Hand: [Hidden Card], 6 of Diamonds\nPlayer's Hand (20): King of Hearts, 10 of Diamonds\n\nWould you like to (H)it or (S)tand? s\nYou chose to stand."
        }
      ]
    },
    {
      "id": "blackjack-source-page-34",
      "sourcePageStart": 34,
      "sourcePageEnd": 34,
      "sourcePages": [
        34
      ],
      "title": "Milestone Checkpoint: Full Round Lifecycle Coordinated!",
      "kind": "information",
      "checkpointIndex": 12,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have coordinated the complete single round workflow:"
        },
        {
          "type": "paragraph",
          "text": "☑  Deal & Reveal: Managed opening deal and hole card concealment."
        },
        {
          "type": "paragraph",
          "text": "☑  Turn Sequencing: Coordinated player choices followed by automated dealer rules."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate game = BlackjackGame(). Run game.play_round() once, make a choice, and verify all stages execute cleanly."
        }
      ]
    },
    {
      "id": "blackjack-source-page-35",
      "sourcePageStart": 35,
      "sourcePageEnd": 35,
      "sourcePages": [
        35
      ],
      "title": "6.3 Rematch & Multi-Round Loop",
      "kind": "task",
      "checkpointIndex": 13,
      "checkpointId": "blackjack-task-14",
      "taskId": "blackjack-task-14",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Interactive Pacing: Rematch Confirmation"
        },
        {
          "type": "paragraph",
          "text": "To provide an authentic arcade and casino experience, the application must prompt the player after each round to ask if they would like to play another round. Clean input validation prevents crashes on invalid responses."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 14 — Implement askReplay()"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement ask_replay() (or askReplay()):"
        },
        {
          "type": "paragraph",
          "text": "Think of a friendly dealer asking if you'd like another hand before clearing the table."
        },
        {
          "type": "paragraph",
          "text": "Goal: Repeatedly prompt until a valid affirmative or negative answer is entered."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Interactive Rematch Confirmation Loop☐  Construct a loop prompting \"\\nPlay another round? (y/n): \"."
        },
        {
          "type": "paragraph",
          "text": "Think of accepting a nod (yes) or a shake of the head (no)."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Return True for yes, False for no, or prompt again."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Normalize Input and Return Decision☐  Sanitize input: if \"y\" or \"yes\", return True; if \"n\" or \"no\", return False; otherwise print guidance message and continue loop."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Play another round? (y/n): y"
        }
      ]
    },
    {
      "id": "blackjack-source-page-36",
      "sourcePageStart": 36,
      "sourcePageEnd": 36,
      "sourcePages": [
        36
      ],
      "title": "Milestone Checkpoint: Rematch Prompt Functional!",
      "kind": "information",
      "checkpointIndex": 13,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented defensive rematch prompting:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Affirmative / Negative Branches: Correctly recognized y and n variants."
        },
        {
          "type": "paragraph",
          "text": "☑  Error Recovery: Polite re-prompt on ambiguous input."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call BlackjackGame.ask_replay(), test typing x then y, and verify True is returned."
        }
      ]
    },
    {
      "id": "blackjack-source-page-37",
      "sourcePageStart": 37,
      "sourcePageEnd": 37,
      "sourcePages": [
        37
      ],
      "title": "Continuous Session Operations: The Multi-Round Loop",
      "kind": "task",
      "checkpointIndex": 14,
      "checkpointId": "blackjack-task-15",
      "taskId": "blackjack-task-15",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The session manager links round execution and replay confirmation into a continuous operational loop. When the player finally chooses to exit, the session displays their final lifetime statistics and a warm farewell."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 15 — Implement playMany() for continuous play"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement play_many() (or playMany()):"
        },
        {
          "type": "paragraph",
          "text": "Think of welcoming a guest into the casino cardroom."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print the initial greeting banner."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Display Welcome Greeting☐  Call print_welcome()."
        },
        {
          "type": "paragraph",
          "text": "Think of dealing round after round as long as the player wishes to stay at the table."
        },
        {
          "type": "paragraph",
          "text": "Goal: Execute rounds in a loop until the player declines a rematch."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Continuous Round Execution Loop☐  In a loop, call self.play_round()."
        },
        {
          "type": "paragraph",
          "text": "Think of cashing out your chips and receiving a final receipt of your session score."
        },
        {
          "type": "paragraph",
          "text": "Goal: Check replay choice, print final cumulative stats, and bid farewell on exit."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Prompt Replay and Present Final Session Stats on Exit☐  If not self.ask_replay(), print \"\\nFinal Session Stats:\", call display_scoreboard(), print \"Thanks for playing Blackjack!\", and break the loop."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Final Session Stats:\n\n------------------------------------\nSCOREBOARD: Player: 1 | Dealer: 0 | Ties: 0\n------------------------------------\nThanks for playing Blackjack!"
        }
      ]
    },
    {
      "id": "blackjack-source-page-38",
      "sourcePageStart": 38,
      "sourcePageEnd": 38,
      "sourcePages": [
        38
      ],
      "title": "Milestone Checkpoint: Continuous Session Play Operational!",
      "kind": "information",
      "checkpointIndex": 14,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed multi-round session control:"
        },
        {
          "type": "paragraph",
          "text": "☑  Continuous Play: Handled consecutive rounds seamlessly without restarting the application."
        },
        {
          "type": "paragraph",
          "text": "☑  Clean Exit Summary: Rendered final cumulative tally upon exit."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call game.play_many(), play one round, answer n, and verify final statistics print."
        }
      ]
    },
    {
      "id": "blackjack-source-page-39",
      "sourcePageStart": 39,
      "sourcePageEnd": 39,
      "sourcePages": [
        39
      ],
      "title": "Putting It All Together: Application Assembly",
      "kind": "task",
      "checkpointIndex": 15,
      "checkpointId": "blackjack-task-16",
      "taskId": "blackjack-task-16",
      "blocks": [
        {
          "type": "paragraph",
          "text": "The final task connects our modular components into a runnable CLI application through standard entry point conventions."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 16 — Assemble the main() entry point"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Assemble the main() entry function:"
        },
        {
          "type": "paragraph",
          "text": "Think of turning on the casino table lights and assigning a manager."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Instantiate the BlackjackGame controller."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Instantiate Game Manager☐  Instantiate game = BlackjackGame()."
        },
        {
          "type": "paragraph",
          "text": "Think of opening the table for business."
        },
        {
          "type": "paragraph",
          "text": "Goal: Launch the complete multi-round session."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Launch Continuous Session☐  Call game.play_many(). Ensure standard main script guard protects execution."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Welcome to Blackjack!\n\n===== NEW BLACKJACK ROUND =====\nDealer's Hand: [Hidden Card], 6 of Diamonds\nPlayer's Hand (20): King of Hearts, 10 of Diamonds"
        }
      ]
    },
    {
      "id": "blackjack-source-page-40",
      "sourcePageStart": 40,
      "sourcePageEnd": 40,
      "sourcePages": [
        40
      ],
      "title": "Milestone Checkpoint: Full Application Experience Complete!",
      "kind": "information",
      "checkpointIndex": 15,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed the entire Blackjack project:"
        },
        {
          "type": "paragraph",
          "text": "☑  End-to-End Execution: Verified the full game flow from welcome banner to session exit."
        },
        {
          "type": "paragraph",
          "text": "☑  Modular OOP Architecture: Encapsulated state and logic cleanly across classes and functions."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Run your project executable (python Blackjack.py, ./Blackjack, or java Blackjack) and complete a full multi-round game session."
        }
      ]
    },
    {
      "id": "blackjack-source-page-41",
      "sourcePageStart": 41,
      "sourcePageEnd": 41,
      "sourcePages": [
        41
      ],
      "title": "Chapter 7: Reflect & Expand",
      "kind": "information",
      "checkpointIndex": 15,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "7.1 What You Have Built"
        },
        {
          "type": "paragraph",
          "text": "You have engineered a complete, production-grade Blackjack card game from scratch. Let us review the foundational engineering patterns and computer science concepts you practiced:"
        },
        {
          "type": "table",
          "columns": [
            "Feature Area",
            "Architectural Concept",
            "Practical Skill Practiced"
          ],
          "rows": [
            [
              "Domain Modeling",
              "Object-Oriented Entities",
              "Encapsulated rank and suit attributes inside a dedicated Card class with custom string formatting."
            ],
            [
              "Deck Generation",
              "Combinatorics & Collections",
              "Populated a 52-card collection using Cartesian product iteration over suits and ranks."
            ],
            [
              "Randomization",
              "Uniform Permutation",
              "Implemented Fisher-Yates shuffle to guarantee non-deterministic, fair deck dealing."
            ],
            [
              "Dynamic Scoring",
              "Adaptive Rule Evaluation",
              "Resolved the dual-value Ace paradox by greedily counting 11 and iteratively downgrading to 1 to prevent busts."
            ],
            [
              "Information Masking",
              "Game State Management",
              "Managed partial observability by masking the Dealer's hole card until the player concludes their turn."
            ],
            [
              "Defensive Input",
              "Input Sanitization",
              "Built robust CLI loops that clean, lowercase, and validate player commands without runtime crashes."
            ],
            [
              "AI Automation",
              "Rule-Based State Machine",
              "Automated casino house rules requiring the dealer to hit while score is under 17 and stand otherwise."
            ],
            [
              "Session Control",
              "Multi-Round Lifecycle",
              "Orchestrated game replay loops, cumulative win/loss scorekeeping, and clean terminal exits."
            ]
          ]
        }
      ]
    },
    {
      "id": "blackjack-source-page-42",
      "sourcePageStart": 42,
      "sourcePageEnd": 42,
      "sourcePages": [
        42
      ],
      "title": "7.2 Extension Ideas",
      "kind": "information",
      "checkpointIndex": 15,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Now that you have constructed a robust foundational game, consider taking your project to the next level with these real-world enhancements:"
        },
        {
          "type": "paragraph",
          "text": "1.  Betting & Chip Bankroll:"
        },
        {
          "type": "paragraph",
          "text": "Give the player a starting balance of chips (e.g., \\$1000). Prompt for a wager before cards are dealt, payout 1:1 on standard wins, 3:2 on natural Blackjack, and handle bankruptcy when chips reach zero."
        },
        {
          "type": "paragraph",
          "text": "2.  Double Down:"
        },
        {
          "type": "paragraph",
          "text": "Allow the player to double their bet after the initial two-card deal in exchange for agreeing to receive exactly one additional card and immediately standing."
        },
        {
          "type": "paragraph",
          "text": "3.  Split Pairs:"
        },
        {
          "type": "paragraph",
          "text": "When the player receives two cards of identical rank (such as a pair of 8s), permit them to split into two independent hands, placing an equal wager on each and playing them consecutively."
        },
        {
          "type": "paragraph",
          "text": "4.  Multi-Deck Shoe & Penetration:"
        },
        {
          "type": "paragraph",
          "text": "Simulate real casino table conditions by combining 4 to 8 decks into a single shoe and reshuffling only after 75% of the cards have been dealt (penetration threshold)."
        },
        {
          "type": "paragraph",
          "text": "5.  ASCII Card Art Rendering:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Enhance terminal presentation by drawing graphical ASCII cards with bordered boxes and suit glyphs ([A  ], [ 10]) instead of plain text strings."
        }
      ]
    },
    {
      "id": "blackjack-source-page-43",
      "sourcePageStart": 43,
      "sourcePageEnd": 43,
      "sourcePages": [
        43
      ],
      "title": "7.3 Share What You Built! Time to Showcase Your Project!",
      "kind": "information",
      "checkpointIndex": 15,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Your Blackjack application represents a significant software engineering achievement. Do not leave your code hidden on your hard drive — showcase it to mentors, peers, and prospective employers:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Create a GitHub Repository: Push your code with clear commit messages corresponding to each Task milestone.",
            "Write a Professional README: Include a description of the game rules, ASCII architecture diagrams, installation instructions, and sample gameplay runs.",
            "Cross-Language Showcase: Demonstrate mastery of multi-language development by providing reference solutions in Python, C++, and Java within the same repository."
          ]
        }
      ]
    },
    {
      "id": "blackjack-source-page-44",
      "sourcePageStart": 44,
      "sourcePageEnd": 44,
      "sourcePages": [
        44
      ],
      "title": "Appendix: Full Pseudocode Reference",
      "kind": "information",
      "checkpointIndex": 15,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Below is the complete, language-neutral pseudocode for the entire Blackjack application, matching the exact chronological order of Tasks 1 through 16:"
        },
        {
          "type": "code",
          "code": "// Task 1 - Create the entry file and print welcome message\nFUNCTION printWelcome():\n    // Step 2: Welcome Banner Output\n    PRINT \"Welcome to Blackjack!\"\n\n\n// Task 2 - Define standard ranks and suits constants\n// Step 1: Declare Rank Collection\nCONSTANT RANKS = [\"2\", \"3\", \"4\", \"5\", \"6\", \"7\", \"8\", \"9\", \"10\", \"Jack\", \"Queen\", \"King\", \"Ace\"]\n\n// Step 2: Declare Suit Collection\nCONSTANT SUITS = [\"Hearts\", \"Diamonds\", \"Clubs\", \"Spades\"]\n\n\n// Task 3 - Create the Card class\nCLASS Card:\n    // Step 1: Initialize Card Rank and Suit\n    CONSTRUCTOR(rank, suit):\n        self.rank = rank\n        self.suit = suit\n\n    // Step 2: Format Card Description\n    FUNCTION toString():\n        RETURN self.rank + \" of \" + self.suit\n\n\n// Task 4 - Create and populate the 52-card deck\nFUNCTION createDeck():\n    // Step 1: Initialize Empty Deck Collection\n    deck = []\n\n    // Step 2: Populate Combinations with Nested Loops\n    FOR EACH suit IN SUITS:\n        FOR EACH rank IN RANKS:\n            deck.APPEND(NEW Card(rank, suit))\n\n    // Step 3: Return Completed Deck\n    RETURN deck\n\n\n// Task 5 - Shuffle the deck\nFUNCTION shuffleDeck(deck):\n    // Step 1: Receive Deck Reference\n    // Step 2: Randomize Card Positions in Place\n    SHUFFLE_IN_PLACE(deck)\n\n\n// Task 6 - Deal a card from the deck\nFUNCTION dealCard(deck):\n    // Step 1: Extract Top Card from Collection\n    // Step 2: Return Dealt Card\n    RETURN deck.POP()\n\n\n// Task 7 - Calculate hand value with automatic Ace adjustment\nFUNCTION calculateScore(hand):\n    // Step 1: Initialize Point Accumulator and Ace Counter"
        }
      ]
    },
    {
      "id": "blackjack-source-page-45",
      "sourcePageStart": 45,
      "sourcePageEnd": 45,
      "sourcePages": [
        45
      ],
      "title": "Source page 45",
      "kind": "information",
      "checkpointIndex": 15,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "total = 0\n    aceCount = 0\n\n    // Step 2: Accumulate Card Values and Count Aces\n    FOR EACH card IN hand:\n        IF card.rank IN [\"Jack\", \"Queen\", \"King\"]:\n            total = total + 10\n        ELSE IF card.rank == \"Ace\":\n            total = total + 11\n            aceCount = aceCount + 1\n        ELSE:\n            total = total + TO_INTEGER(card.rank)\n\n    // Step 3: Dynamically Downgrade Aces to Avoid Busting\n    WHILE total > 21 AND aceCount > 0:\n        total = total - 10\n        aceCount = aceCount - 1\n\n    // Step 4: Return Calculated Hand Score\n    RETURN total\n\n\n// Task 8 - Display hands with hidden hole card support\nFUNCTION displayHand(ownerName, hand, hideFirstCard):\n    // Step 1: Check Hole Card Masking Flag\n    IF hideFirstCard IS TRUE:\n        // Step 2: Render Masked Hand for Dealer\n        PRINT ownerName + \"'s Hand: [Hidden Card], \" + hand[1].toString()\n    ELSE:\n        // Step 3: Render Formatted Visible Hand with Score\n        cardsString = JOIN_STRINGS(hand, \", \")\n        score = calculateScore(hand)\n        PRINT ownerName + \"'s Hand (\" + score + \"): \" + cardsString\n\n\n// Task 9 - Prompt and validate Player choice (Hit or Stand)\nFUNCTION getPlayerChoice():\n    // Step 1: Interactive Input Prompt Loop\n    LOOP:\n        PROMPT \"\\nWould you like to (H)it or (S)tand? \"\n        // Step 2: Clean and Normalize Input\n        choice = READ_INPUT().TRIM().TO_LOWER()\n\n        // Step 3: Evaluate Valid Choice or Re-prompt\n        IF choice IN [\"h\", \"hit\"]:\n            RETURN \"h\"\n        ELSE IF choice IN [\"s\", \"stand\"]:\n            RETURN \"s\"\n        ELSE:\n            PRINT \"Invalid input. Please enter 'h' to hit or 's' to stand.\"\n\n\n// Task 10 - Execute Dealer's automated turn\nFUNCTION playDealerTurn(deck, dealerHand):\n    // Step 1: Announce Dealer Turn and Reveal Hole Card\n    PRINT \"\\n--- Dealer's Turn ---\"\n    displayHand(\"Dealer\", dealerHand, FALSE)\n\n    // Step 2: Automated Hit Loop While Score Under 17\n    WHILE calculateScore(dealerHand) < 17:\n        // Step 3: Draw Card, Announce Draw, and Refresh Display\n        card = dealCard(deck)"
        }
      ]
    },
    {
      "id": "blackjack-source-page-46",
      "sourcePageStart": 46,
      "sourcePageEnd": 46,
      "sourcePages": [
        46
      ],
      "title": "Source page 46",
      "kind": "information",
      "checkpointIndex": 15,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "dealerHand.APPEND(card)\n        PRINT \"Dealer hits and draws: \" + card.toString()\n        displayHand(\"Dealer\", dealerHand, FALSE)\n\n    // Step 4: Evaluate and Announce Dealer Stand or Bust\n    score = calculateScore(dealerHand)\n    IF score > 21:\n        PRINT \"Dealer busted!\"\n    ELSE:\n        PRINT \"Dealer stands with \" + score + \".\"\n\n\n// Task 11 - Determine and announce round outcome\nFUNCTION determineOutcome(playerHand, dealerHand):\n    // Step 1: Calculate Final Scores and Display Matchup Summary\n    playerScore = calculateScore(playerHand)\n    dealerScore = calculateScore(dealerHand)\n\n    PRINT \"\\n===== ROUND RESULT =====\"\n    displayHand(\"Player\", playerHand, FALSE)\n    displayHand(\"Dealer\", dealerHand, FALSE)\n\n    // Step 2: Check Player Bust Condition\n    IF playerScore > 21:\n        PRINT \"\\nDealer wins! You went over 21.\"\n        RETURN \"dealer\"\n\n    // Step 3: Check Dealer Bust Condition\n    ELSE IF dealerScore > 21:\n        PRINT \"\\nYou win! Dealer went over 21.\"\n        RETURN \"player\"\n\n    // Step 4: Compare Final Hand Scores and Announce Result\n    ELSE IF playerScore > dealerScore:\n        PRINT \"\\nYou win! Your \" + playerScore + \" beats Dealer's \" + dealerScore + \".\"\n        RETURN \"player\"\n    ELSE IF dealerScore > playerScore:\n        PRINT \"\\nDealer wins! Dealer's \" + dealerScore + \" beats your \" + playerScore + \".\"\n        RETURN \"dealer\"\n    ELSE:\n        // Step 5: Return Standard Outcome Identifier\n        PRINT \"\\nIt's a push (tie)! Both have \" + playerScore + \".\"\n        RETURN \"tie\"\n\n\n// Task 12 - Manage and display session scoreboard\nFUNCTION displayScoreboard(playerWins, dealerWins, ties):\n    // Step 1: Format Scoreboard Card Border\n    PRINT \"\\n------------------------------------\"\n    // Step 2: Print Cumulative Tally Line\n    PRINT \"SCOREBOARD: Player: \" + playerWins + \" | Dealer: \" + dealerWins + \" | Ties: \" + ties\n    PRINT \"------------------------------------\"\n\n\n// Task 13 - Create BlackjackGame class and implement playRound()\nCLASS BlackjackGame:\n    CONSTRUCTOR():\n        // Step 1: Initialize Session Score Counters\n        self.playerWins = 0\n        self.dealerWins = 0\n        self.ties = 0"
        }
      ]
    },
    {
      "id": "blackjack-source-page-47",
      "sourcePageStart": 47,
      "sourcePageEnd": 47,
      "sourcePages": [
        47
      ],
      "title": "Source page 47",
      "kind": "information",
      "checkpointIndex": 15,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "FUNCTION updateScores(outcome):\n        IF outcome == \"player\":\n            self.playerWins = self.playerWins + 1\n        ELSE IF outcome == \"dealer\":\n            self.dealerWins = self.dealerWins + 1\n        ELSE IF outcome == \"tie\":\n            self.ties = self.ties + 1\n        displayScoreboard(self.playerWins, self.dealerWins, self.ties)\n\n    FUNCTION playRound():\n        // Step 2: Generate, Shuffle, and Deal Opening Cards\n        deck = createDeck()\n        shuffleDeck(deck)\n\n        playerHand = [dealCard(deck), dealCard(deck)]\n        dealerHand = [dealCard(deck), dealCard(deck)]\n\n        // Step 3: Render Opening Hands with Dealer Hole Card Masked\n        PRINT \"\\n===== NEW BLACKJACK ROUND =====\"\n        displayHand(\"Dealer\", dealerHand, TRUE)\n        displayHand(\"Player\", playerHand, FALSE)\n\n        // Step 4: Check Natural Opening Blackjack\n        IF calculateScore(playerHand) == 21:\n            PRINT \"\\nBlackjack! You have 21!\"\n            outcome = determineOutcome(playerHand, dealerHand)\n            self.updateScores(outcome)\n            RETURN\n\n        // Step 5: Execute Interactive Player Turn Loop\n        WHILE calculateScore(playerHand) < 21:\n            choice = getPlayerChoice()\n            IF choice == \"h\":\n                card = dealCard(deck)\n                playerHand.APPEND(card)\n                PRINT \"\\nYou drew: \" + card.toString()\n                displayHand(\"Player\", playerHand, FALSE)\n            ELSE:\n                PRINT \"\\nYou chose to stand.\"\n                BREAK\n\n        IF calculateScore(playerHand) > 21:\n            PRINT \"\\nYou busted with \" + calculateScore(playerHand) + \"!\"\n            outcome = determineOutcome(playerHand, dealerHand)\n            self.updateScores(outcome)\n            RETURN\n\n        // Step 6: Execute Dealer Turn and Resolve Outcome\n        playDealerTurn(deck, dealerHand)\n        outcome = determineOutcome(playerHand, dealerHand)\n        self.updateScores(outcome)\n\n    // Task 14 - Implement askReplay()\n    STATIC FUNCTION askReplay():\n        // Step 1: Interactive Rematch Confirmation Loop\n        LOOP:\n            // Step 2: Normalize Input and Return Decision\n            PROMPT \"\\nPlay another round? (y/n): \"\n            choice = READ_INPUT().TRIM().TO_LOWER()\n            IF choice IN [\"y\", \"yes\"]:\n                RETURN TRUE\n            ELSE IF choice IN [\"n\", \"no\"]:"
        }
      ]
    },
    {
      "id": "blackjack-source-page-48",
      "sourcePageStart": 48,
      "sourcePageEnd": 48,
      "sourcePages": [
        48
      ],
      "title": "Source page 48",
      "kind": "information",
      "checkpointIndex": 15,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "RETURN FALSE\n            ELSE:\n                PRINT \"Please enter 'y' for yes or 'n' for no.\"\n\n    // Task 15 - Implement playMany() for continuous play\n    FUNCTION playMany():\n        // Step 1: Display Welcome Greeting\n        printWelcome()\n\n        // Step 2: Continuous Round Execution Loop\n        LOOP:\n            self.playRound()\n\n            // Step 3: Prompt Replay and Present Final Session Stats on Exit\n            IF NOT self.askReplay():\n                PRINT \"\\nFinal Session Stats:\"\n                displayScoreboard(self.playerWins, self.dealerWins, self.ties)\n                PRINT \"Thanks for playing Blackjack!\"\n                BREAK\n\n\n// Task 16 - Assemble the main() entry point\nFUNCTION main():\n    // Step 1: Instantiate Game Manager\n    game = NEW BlackjackGame()\n\n    // Step 2: Launch Continuous Session\n    game.playMany()"
        }
      ]
    }
  ],
  "hangman": [
    {
      "id": "hangman-source-page-01",
      "sourcePageStart": 1,
      "sourcePageEnd": 1,
      "sourcePages": [
        1
      ],
      "title": "Hangman Word Guessing Game",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "Chapter 1: Introduction"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "1.1 Getting Started"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Meet Your Project"
        },
        {
          "type": "paragraph",
          "text": "You are about to build Hangman — the classic word-guessing puzzle — as a fully functional, interactive terminal game. In this project, a secret word is selected at random from an approved vocabulary bank, and the player attempts to decipher it one letter at a time before running out of attempts."
        },
        {
          "type": "paragraph",
          "text": "This project reinforces essential software development patterns: string manipulation, character iteration, state tracking, defensive CLI input parsing, procedural-to-object-oriented architecture transitions, and terminal visualization with ASCII art."
        },
        {
          "type": "code",
          "code": "By completing this workbook, you will gain hands-on mastery over stateful game loops, collection filtering, input sanitation, and class construction in Python, C++, or Java."
        }
      ]
    },
    {
      "id": "hangman-source-page-02",
      "sourcePageStart": 2,
      "sourcePageEnd": 2,
      "sourcePages": [
        2
      ],
      "title": "What You Will Learn",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Throughout this guided curriculum, you will build this application step by step. By the end, you will have a complete, production-grade project you can execute, explain, and expand."
        },
        {
          "type": "paragraph",
          "text": "You will learn how to:"
        },
        {
          "type": "paragraph",
          "text": "1.  Maintain immutable word collections and configuration constants without magic numbers"
        },
        {
          "type": "paragraph",
          "text": "2.  Dynamically mask and unmask secret strings based on player guess histories"
        },
        {
          "type": "paragraph",
          "text": "3.  Validate user inputs defensively against invalid character counts, non-alphabetic inputs, and duplicate guesses"
        },
        {
          "type": "paragraph",
          "text": "4.  Render multi-stage ASCII gallows visual art corresponding precisely to the remaining lives count"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "5.  Encapsulate mutable round data inside an object-oriented Hangman class"
        },
        {
          "type": "paragraph",
          "text": "6.  Drive a turn-based execution loop that alternates between state updates and screen presentations"
        },
        {
          "type": "paragraph",
          "text": "7.  Handle end-of-game victory and defeat conditions gracefully with informative feedback"
        },
        {
          "type": "paragraph",
          "text": "8.  Implement an interactive rematch confirmation cycle that allows players to enjoy continuous gaming sessions"
        }
      ]
    },
    {
      "id": "hangman-source-page-03",
      "sourcePageStart": 3,
      "sourcePageEnd": 3,
      "sourcePages": [
        3
      ],
      "title": "What You Need",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Before you begin, ensure you have basic familiarity with:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Terminal input and output (input() / print() in Python, cin / cout in C++, Scanner / System.out.println() in Java)",
            "Primitive data types, strings, lists/vectors, and arrays",
            "Conditional decision making (if / else) and loops (while, for)",
            "Basic class declarations and instance methods"
          ]
        }
      ]
    },
    {
      "id": "hangman-source-page-04",
      "sourcePageStart": 4,
      "sourcePageEnd": 4,
      "sourcePages": [
        4
      ],
      "title": "1.2 Starting with Small Steps",
      "kind": "task",
      "checkpointIndex": 0,
      "checkpointId": "hangman-task-1",
      "taskId": "hangman-task-1",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "First Steps into Code: The Welcome Banner"
        },
        {
          "type": "paragraph",
          "text": "Every well-engineered application starts with a clean greeting that informs the player what software has launched. We begin by creating our project entry file and defining our banner printer."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 1 — Create the entry file and print welcome message"
        },
        {
          "type": "paragraph",
          "text": "Establish the application entry file and output the initial greeting banner:"
        },
        {
          "type": "paragraph",
          "text": "Think of laying the foundation stones and unlocking your workbench before assembling a project."
        },
        {
          "type": "paragraph",
          "text": "Goal: Create your project source file and import foundational standard modules."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Entry File Setup☐  Create your project source file (Hangman.py, Hangman.cpp, or Hangman.java).☐  Include required foundational standard libraries and establish the primary module namespace."
        },
        {
          "type": "paragraph",
          "text": "Think of illuminated neon signage outside an arcade signaling that the game is open and running."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print the official game title to the terminal standard output."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Welcome Banner Output☐  Define a function or method named print_welcome() (or printWelcome()).☐  Print the text \"Welcome to Hangman!\" followed by a newline."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Welcome to Hangman!"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Welcome Banner Functional!"
        },
        {
          "type": "paragraph",
          "text": "You have established the entry point of your application:"
        },
        {
          "type": "paragraph",
          "text": "☑  Source File Established: Created clean project file with required system imports."
        },
        {
          "type": "paragraph",
          "text": "☑  Banner Output Operational: Greeting function cleanly outputs the game title."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Execute print_welcome() (or printWelcome()). Verify that Welcome to Hangman! prints cleanly to the console."
        }
      ]
    },
    {
      "id": "hangman-source-page-05",
      "sourcePageStart": 5,
      "sourcePageEnd": 5,
      "sourcePages": [
        5
      ],
      "title": "Secret Word Pool & Lives Boundary",
      "kind": "task",
      "checkpointIndex": 1,
      "checkpointId": "hangman-task-2",
      "taskId": "hangman-task-2",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Hangman requires an approved vocabulary list from which mystery words are picked, an integer defining how many incorrect guesses are allowed before defeat, and graphical representations for each mistake stage."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 2 — Define word pool, maximum lives, and gallows stages"
        },
        {
          "type": "paragraph",
          "text": "Define the immutable word list, lives limit, and ASCII gallows illustrations:"
        },
        {
          "type": "paragraph",
          "text": "Think of loading a card deck with approved mystery vocabulary words."
        },
        {
          "type": "paragraph",
          "text": "Goal: Declare the constant list/array of uppercase mystery puzzle words."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Declare Secret Word Pool☐  Declare a constant list or array named WORDS populated with uppercase words: \"PYTHON\", \"PLANET\", \"ROBOT\", \"GUITAR\", \"SILVER\", \"ROCKET\", \"CODING\"."
        },
        {
          "type": "paragraph",
          "text": "Think of painting 6 full hearts on a classic video game life bar."
        },
        {
          "type": "paragraph",
          "text": "Goal: Establish the maximum allowable mistake threshold as an immutable constant."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Declare Maximum Lives Threshold☐  Declare an integer constant named MAX_LIVES set to 6."
        },
        {
          "type": "paragraph",
          "text": "Think of sketching out an artist's flipbook where each page adds one line to the drawing."
        },
        {
          "type": "paragraph",
          "text": "Goal: Store the 7 progressive multiline ASCII gallows strings in an indexed collection."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Declare Gallows ASCII Art Stages☐  Declare a list or array named STAGES containing 7 multiline ASCII strings representing mistake counts from 0 (empty gallows) up to 6 (full figure / Game Over)."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Game Configuration Defined!"
        },
        {
          "type": "paragraph",
          "text": "You have established the core parameters of the game:"
        },
        {
          "type": "paragraph",
          "text": "☑  Word Pool Established: 7 distinct uppercase words configured."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Lives Limit Fixed: MAX_LIVES = 6 without magic numbers."
        },
        {
          "type": "paragraph",
          "text": "☑  Gallows Art Configured: 7 progressive visual stages indexed by mistake count."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Print len(WORDS) (or WORDS.size() / WORDS.length) and verify it equals 7. Print len(STAGES) and verify it equals 7. Print MAX_LIVES and verify it equals 6."
        }
      ]
    },
    {
      "id": "hangman-source-page-06",
      "sourcePageStart": 6,
      "sourcePageEnd": 6,
      "sourcePages": [
        6
      ],
      "title": "Chapter 2: Specifications & Architectural Plan",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "2.1 Understanding the Domain & Rules"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Core Rules & Multi-Stage Gallows Mechanics"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Hangman is played between a single player and the computer. In each round, the computer chooses a secret word from WORDS, and the player attempts to uncover all letters of the secret word before making 6 incorrect guesses."
        },
        {
          "type": "paragraph",
          "text": "The rules and visual states are governed by mistake counts:"
        },
        {
          "type": "table",
          "columns": [
            "Mistakes",
            "Lives Remaining",
            "Visual Figure Description",
            "Game State"
          ],
          "rows": [
            [
              "0",
              "6",
              "Empty gallows beam and rope",
              "Active Play (Fresh Round)"
            ],
            [
              "1",
              "5",
              "Head (O) attached to rope",
              "Active Play"
            ],
            [
              "2",
              "4",
              "Torso (`",
              "`) drawn"
            ],
            [
              "3",
              "3",
              "Left arm (/) drawn",
              "Active Play"
            ],
            [
              "4",
              "2",
              "Right arm (\\) drawn",
              "Active Play"
            ],
            [
              "5",
              "1",
              "Left leg (/) drawn",
              "Danger: Final Life!"
            ],
            [
              "6",
              "0",
              "Right leg (\\) drawn",
              "Defeat (Game Over)"
            ]
          ]
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Character Masking & Reveal Pipeline"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "At any point in the game, the word is displayed with known letters revealed and unsolved letters hidden as underscores (_). Each character is separated by a single space for clear readability:"
        },
        {
          "type": "paragraph",
          "text": "/"
        },
        {
          "type": "paragraph",
          "text": "1.  For each character in the secret word, check if it exists in the player's guessed letters list."
        },
        {
          "type": "paragraph",
          "text": "2.  If the character has been guessed, keep the letter visible."
        },
        {
          "type": "image",
          "src": "/assets/projects/guides/hangman/image1.png",
          "alt": "Hangman game flow diagram",
          "caption": "Hangman game flow diagram"
        }
      ]
    },
    {
      "id": "hangman-source-page-07",
      "sourcePageStart": 7,
      "sourcePageEnd": 7,
      "sourcePages": [
        7
      ],
      "title": "3.  If the character has not been guessed yet, replace it with an underscore (_).",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "4.  Join the resulting characters with single space delimiters (e.g., \"P _ _ _ E _\" for \"PLANET\" with guesses ['P', 'E'])."
        }
      ]
    },
    {
      "id": "hangman-source-page-08",
      "sourcePageStart": 8,
      "sourcePageEnd": 8,
      "sourcePages": [
        8
      ],
      "title": "2.2 Chronological Execution Flow",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Five-Stage Match Execution Lifecycle"
        },
        {
          "type": "paragraph",
          "text": "A complete application session proceeds through five distinct stages:"
        },
        {
          "type": "paragraph",
          "text": "/"
        },
        {
          "type": "paragraph",
          "text": "1.  System Inception & Greeting: Launch the program, display the executive welcome banner, and establish game constants."
        },
        {
          "type": "paragraph",
          "text": "2.  Game State Initialization: Pick a random secret word, initialize the guessed letters collection to empty, and set wrong guesses to 0."
        },
        {
          "type": "paragraph",
          "text": "3.  Turn-Based Board & Input Loop: Render the current gallows ASCII art, display the masked word, show previous guesses and lives remaining, prompt for a single letter, validate input, and record the guess."
        },
        {
          "type": "paragraph",
          "text": "4.  Outcome Evaluation: Verify if all letters in the secret word have been solved (Victory) or if the player has accumulated 6 mistakes (Defeat)."
        },
        {
          "type": "paragraph",
          "text": "5.  Outcome Announcement & Replay: Announce congratulations or reveal the secret word, prompt for rematch confirmation, and restart or exit cleanly."
        },
        {
          "type": "image",
          "src": "/assets/projects/guides/hangman/image2.png",
          "alt": "Hangman program structure diagram",
          "caption": "Hangman program structure diagram"
        }
      ]
    },
    {
      "id": "hangman-source-page-09",
      "sourcePageStart": 9,
      "sourcePageEnd": 9,
      "sourcePages": [
        9
      ],
      "title": "2.3 System Architecture: Thinking in OOP",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Component Responsibilities & Class Hierarchy"
        },
        {
          "type": "code",
          "code": "Separating the game into helper functions and a stateful Hangman class isolates data, simplifies debugging, and enables multi-game sessions:"
        },
        {
          "type": "paragraph",
          "text": "/"
        },
        {
          "type": "table",
          "columns": [
            "Component",
            "Responsibility"
          ],
          "rows": [
            [
              "HangmanHelperFunctions",
              "Houses pure static utilities and constants: WORDS, MAX_LIVES, STAGES, getMaskedWord(), isWordGuessed(), formatGuessedLetters(), displayBoard(), and getValidGuess()."
            ],
            [
              "Hangman",
              "Holds mutable round state (secretWord, guessedLetters, wrongGuesses). Manages word randomization, single-guess processing, outcome evaluation, turn loops, and replay flow."
            ],
            [
              "MainProgram",
              "Serves as the program entry point: displays the welcome banner, instantiates the Hangman engine, and starts the session loop."
            ]
          ]
        },
        {
          "type": "image",
          "src": "/assets/projects/guides/hangman/image3.png",
          "alt": "Hangman rules diagram",
          "caption": "Hangman rules diagram"
        }
      ]
    },
    {
      "id": "hangman-source-page-10",
      "sourcePageStart": 10,
      "sourcePageEnd": 10,
      "sourcePages": [
        10
      ],
      "title": "Chapter 3: Core Word Masking Logic",
      "kind": "task",
      "checkpointIndex": 2,
      "checkpointId": "hangman-task-3",
      "taskId": "hangman-task-3",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "3.1 Word Masking Pipeline"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Masked String Generation"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "In Hangman, the player must never see the full secret word until they have correctly guessed its letters. We need a function that takes the secret_word and the collection of guessed_letters, and outputs a spaced masked string."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 3 — Build the masked word string"
        },
        {
          "type": "paragraph",
          "text": "Construct the formatted string displaying guessed letters and underscores:"
        },
        {
          "type": "paragraph",
          "text": "Think of laying out an empty tray of tile holders matching the length of the secret word."
        },
        {
          "type": "paragraph",
          "text": "Goal: Prepare an empty collection container to hold the display characters."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Initialize Masked Character Collection☐  Initialize an empty collection or accumulator named display_chars (or masked)."
        },
        {
          "type": "paragraph",
          "text": "Think of flipping over only those tiles on the puzzle board whose letters have been called."
        },
        {
          "type": "paragraph",
          "text": "Goal: Iterate through the secret word, adding the revealed letter if guessed or an underscore if unsolved."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Iterate Letters and Reveal Guessed Characters☐  Iterate through every character in secret_word.☐  If the character exists in guessed_letters, append the character; otherwise, append an underscore (\"_\")."
        },
        {
          "type": "paragraph",
          "text": "Think of spacing tiles neatly across the game table with a single gap between each space."
        },
        {
          "type": "paragraph",
          "text": "Goal: Join all display characters with single space delimiters and return the resulting masked string."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Join and Return Formatted Masked String☐  Combine characters with space delimiters and return the final string."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Masked Word Generator Operational!"
        },
        {
          "type": "paragraph",
          "text": "You have implemented dynamic word masking:"
        },
        {
          "type": "paragraph",
          "text": "☑  Character Inspection: Accurately matches guessed characters against target secret letters."
        },
        {
          "type": "paragraph",
          "text": "☑  Visual Masking: Replaces unrevealed letters with underscores separated by spaces."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Execute get_masked_word(\"PLANET\", ['P', 'E']). Verify that the return value is \"P _ _ _ E _\"."
        }
      ]
    },
    {
      "id": "hangman-source-page-11",
      "sourcePageStart": 11,
      "sourcePageEnd": 11,
      "sourcePages": [
        11
      ],
      "title": "3.2 Win Condition Evaluation",
      "kind": "task",
      "checkpointIndex": 3,
      "checkpointId": "hangman-task-4",
      "taskId": "hangman-task-4",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Word Completion Scan"
        },
        {
          "type": "paragraph",
          "text": "To determine if the player has won the game, we must verify whether every character in the secret word has been guessed. If even a single letter remains unsolved, the game has not been won."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 4 — Check word completion status"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Verify if all letters of the secret word are present in the guessed letters set:"
        },
        {
          "type": "paragraph",
          "text": "Think of a puzzle inspector checking the board for any remaining blank spaces."
        },
        {
          "type": "paragraph",
          "text": "Goal: Iterate through the secret word to verify whether any character has not yet been guessed."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Scan Secret Word for Unsolved Letters☐  Iterate through each character in secret_word.☐  If any character is not found in guessed_letters, immediately return False."
        },
        {
          "type": "paragraph",
          "text": "Think of sounding the victory buzzer the moment every single tile is uncovered."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Return False if any unsolved letter is found, or True once all letters are solved."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Return Boolean Guess Status☐  If the loop completes without finding any missing letters, return True."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Win Condition Logic Verified!"
        },
        {
          "type": "paragraph",
          "text": "You have implemented the game completion check:"
        },
        {
          "type": "paragraph",
          "text": "☑  Exhaustive Scanning: Scans every character in the target secret word."
        },
        {
          "type": "paragraph",
          "text": "☑  Early Exit: Immediately detects incomplete words and returns boolean status accurately."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Execute is_word_guessed(\"ROBOT\", ['R', 'O', 'B', 'T']) -> verify True."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Execute is_word_guessed(\"ROBOT\", ['R', 'O', 'B']) -> verify False."
        }
      ]
    },
    {
      "id": "hangman-source-page-12",
      "sourcePageStart": 12,
      "sourcePageEnd": 12,
      "sourcePages": [
        12
      ],
      "title": "Chapter 4: Visual Board & Defensive Input Pipeline",
      "kind": "task",
      "checkpointIndex": 4,
      "checkpointId": "hangman-task-5",
      "taskId": "hangman-task-5",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "4.1 Formatted Board Rendering"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Alphabetical Guessed Letters & Visual Board"
        },
        {
          "type": "paragraph",
          "text": "Presenting information clearly is vital in CLI games. The player needs to see an organized list of previously guessed letters, their remaining lives, the current gallows illustration, and the masked word."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 5 — Format guessed letters display"
        },
        {
          "type": "paragraph",
          "text": "Format previous guesses into an alphabetically sorted, comma-separated string:"
        },
        {
          "type": "paragraph",
          "text": "Think of filing index cards in alphabetical order from A to Z so they are effortless to scan."
        },
        {
          "type": "paragraph",
          "text": "Goal: Sort the accumulated guessed letters collection into alphabetical order."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Sort Guessed Letters Alphabetically☐  Check if guessed_letters is empty; if empty, return \"None\".☐  Sort a copy of the guessed letters collection in ascending alphabetical order."
        },
        {
          "type": "paragraph",
          "text": "Think of printing a neat roster list on a scoreboard banner."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Return \"None\" if no letters have been guessed, or join the sorted letters with \", \" separators."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Construct Comma-Separated Guessed Letters String☐  Join the sorted letters with comma-space delimiters (\", \") and return the resulting string."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Guessed Letters Formatter Functional!"
        },
        {
          "type": "paragraph",
          "text": "You have created a clean presentation helper for used letters:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Empty Handling: Displays \"None\" when no guesses have been registered."
        },
        {
          "type": "paragraph",
          "text": "☑  Alphabetical Ordering: Always sorts letters predictably for rapid visual scanning."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Execute format_guessed_letters([]) -> verify \"None\"."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Execute format_guessed_letters(['Z', 'A', 'M']) -> verify \"A, M, Z\"."
        }
      ]
    },
    {
      "id": "hangman-source-page-13",
      "sourcePageStart": 13,
      "sourcePageEnd": 13,
      "sourcePages": [
        13
      ],
      "title": "Task 6 — Render gallows and full game board",
      "kind": "task",
      "checkpointIndex": 5,
      "checkpointId": "hangman-task-6",
      "taskId": "hangman-task-6",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Display the complete visual state of the game board in the console:"
        },
        {
          "type": "paragraph",
          "text": "Think of flipping to the exact page of the flipbook matching the player's current mistake count."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Retrieve and print STAGES[wrong_guesses] from the gallows art collection."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Print Gallows ASCII Stage for Current Mistake Count☐  Access STAGES[wrong_guesses] and print the corresponding ASCII illustration."
        },
        {
          "type": "paragraph",
          "text": "Think of illuminating the mystery puzzle board so the player sees their current progress."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Call get_masked_word() and print the spaced secret word representation."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Print Masked Word Display☐  Call get_masked_word(secret_word, guessed_letters) and print the formatted word line."
        },
        {
          "type": "paragraph",
          "text": "Think of displaying a side panel showing all previously called letters."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Call format_guessed_letters() and print the used letter roster."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Print Formatted Guessed Letters☐  Call format_guessed_letters(guessed_letters) and print the guessed letters line."
        },
        {
          "type": "paragraph",
          "text": "Think of a digital health gauge displaying remaining hit points out of maximum capacity."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Calculate remaining lives and print the formatted tally (lives_left / MAX_LIVES)."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Print Remaining Lives Tally☐  Calculate lives_left = MAX_LIVES - wrong_guesses and print Lives remaining: {lives_left} / {MAX_LIVES}."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "+---+\n  |   |\n      |\n      |\n      |\n      |\n=========\nWord: P _ _ _ E _\nGuessed letters: E, P\nLives remaining: 6 / 6"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Visual Board Display Operational!"
        },
        {
          "type": "paragraph",
          "text": "You have assembled the complete game state visualizer:"
        },
        {
          "type": "paragraph",
          "text": "☑  Visual State Integration: Combines gallows art, masked word, used letters, and lives."
        },
        {
          "type": "paragraph",
          "text": "☑  Mistake Indexing: Dynamically maps mistakes directly to ASCII gallows stages."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Execute display_board(2, \"PYTHON\", ['P', 'O']). Verify that stage 2 (head + torso) is printed with \"Word: P _ _ _ O _\", \"Guessed letters: O, P\", and \"Lives remaining: 4 / 6\"."
        }
      ]
    },
    {
      "id": "hangman-source-page-14",
      "sourcePageStart": 14,
      "sourcePageEnd": 14,
      "sourcePages": [
        14
      ],
      "title": "4.2 Defensive Input Validation Engine",
      "kind": "task",
      "checkpointIndex": 6,
      "checkpointId": "hangman-task-7",
      "taskId": "hangman-task-7",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Defensive Programming: CLI Input Validation"
        },
        {
          "type": "paragraph",
          "text": "Players can type anything into a terminal: lowercase letters, multiple letters, symbols, numbers, or empty strings. A robust application must never crash when unexpected input is received. We build a modular 3-stage validation pipeline:"
        },
        {
          "type": "paragraph",
          "text": "1.  Read raw text and normalize to uppercase."
        },
        {
          "type": "paragraph",
          "text": "2.  Validate that input is exactly 1 alphabetic character."
        },
        {
          "type": "paragraph",
          "text": "3.  Check against already guessed letters and prompt until valid."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 7 — Read and normalize letter input"
        },
        {
          "type": "paragraph",
          "text": "Prompt the player and convert raw text into an uppercase character string:"
        },
        {
          "type": "paragraph",
          "text": "Think of the game host stepping forward and asking the player for their letter choice."
        },
        {
          "type": "paragraph",
          "text": "Goal: Display an interactive terminal prompt asking for a single letter."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Prompt Player for Guess Input☐  Display the input prompt \"\\nEnter your guess (a single letter): \" without a trailing newline."
        },
        {
          "type": "paragraph",
          "text": "Think of cleaning off excess ink and stamping a neat uppercase letter on an official ballot."
        },
        {
          "type": "paragraph",
          "text": "Goal: Strip leading/trailing whitespace and convert the input string to uppercase."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Trim Whitespace and Convert to Uppercase☐  Read user input, trim leading/trailing whitespace, and convert characters to uppercase."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Enter your guess (a single letter): e"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Raw Input Capture Operational!"
        },
        {
          "type": "paragraph",
          "text": "You have built the input reader and normalizer:"
        },
        {
          "type": "paragraph",
          "text": "☑  Prompt Presentation: Clearly prompts player for a single letter."
        },
        {
          "type": "paragraph",
          "text": "☑  Case & Whitespace Normalization: Automatically trims spaces and converts to uppercase."
        }
      ]
    },
    {
      "id": "hangman-source-page-15",
      "sourcePageStart": 15,
      "sourcePageEnd": 15,
      "sourcePages": [
        15
      ],
      "title": "Task 8 — Validate character format",
      "kind": "task",
      "checkpointIndex": 7,
      "checkpointId": "hangman-task-8",
      "taskId": "hangman-task-8",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Verify that the input consists of exactly one alphabetic character (A-Z):"
        },
        {
          "type": "paragraph",
          "text": "Think of a coin slot with an exact aperture that rejects anything that is not a single token."
        },
        {
          "type": "paragraph",
          "text": "Goal: Confirm that the trimmed input string has a length of exactly 1 character."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Verify Exactly One Character Length☐  Check if the string length equals 1."
        },
        {
          "type": "paragraph",
          "text": "Think of an automated filter that discards numbers, symbols, and punctuation marks."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Verify that the single character belongs strictly to the alphabet (A-Z)."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Verify Character is Alphabetic☐  Check if the single character is an alphabetic letter (A through Z)."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Character Format Validation Functional!"
        },
        {
          "type": "paragraph",
          "text": "You have built the single-character validator:"
        },
        {
          "type": "paragraph",
          "text": "☑  Length Guard: Rejects empty strings, multiple letters, and whole words."
        },
        {
          "type": "paragraph",
          "text": "☑  Alpha Guard: Rejects numbers, punctuation, and special characters."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Verify is_valid_format(\"A\") is True. Verify is_valid_format(\"AB\"), is_valid_format(\"1\"), and is_valid_format(\"\") are False."
        }
      ]
    },
    {
      "id": "hangman-source-page-16",
      "sourcePageStart": 16,
      "sourcePageEnd": 16,
      "sourcePages": [
        16
      ],
      "title": "Task 9 — Check duplicates and finalize guess input",
      "kind": "task",
      "checkpointIndex": 8,
      "checkpointId": "hangman-task-9",
      "taskId": "hangman-task-9",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Combine format validation with duplicate checking in an interactive retry loop:"
        },
        {
          "type": "paragraph",
          "text": "Think of checking the player's discard pile to confirm this letter has not already been played."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Check whether the valid uppercase character already exists in the guessed_letters collection."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Verify Letter Has Not Been Guessed Yet☐  Check if the sanitized candidate letter already exists in guessed_letters."
        },
        {
          "type": "paragraph",
          "text": "Think of a referee politely reminding the player that a move has already been used."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print an informative message letting the player know they already guessed that letter."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Output Friendly Duplicate Notification☐  If duplicate, print \"You already guessed '{letter}'. Try a different letter.\".☐  If invalid format, print \"Invalid input. Please enter exactly one alphabetic letter (A-Z).\"."
        },
        {
          "type": "paragraph",
          "text": "Think of a turnstile that remains locked until a valid, fresh token is provided."
        },
        {
          "type": "paragraph",
          "text": "Goal: Wrap validation inside an indefinite loop, returning only when a clean, unique letter is received."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Loop Until Valid Unique Letter Received☐  Wrap in a while True loop and return the valid letter as soon as all conditions pass."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Defensive Guess Pipeline Complete!"
        },
        {
          "type": "paragraph",
          "text": "You have completed the bulletproof CLI input subsystem:"
        },
        {
          "type": "paragraph",
          "text": "☑  Input Sanitation: Trims whitespace and enforces single alphabetic character rules."
        },
        {
          "type": "paragraph",
          "text": "☑  Duplicate Defense: Prohibits wasting turns on repeated guesses."
        },
        {
          "type": "paragraph",
          "text": "☑  Continuous Retry: Re-prompts smoothly without crashes."
        }
      ]
    },
    {
      "id": "hangman-source-page-17",
      "sourcePageStart": 17,
      "sourcePageEnd": 17,
      "sourcePages": [
        17
      ],
      "title": "Chapter 5: Building the Game Engine (Thinking in OOP)",
      "kind": "task",
      "checkpointIndex": 9,
      "checkpointId": "hangman-task-10",
      "taskId": "hangman-task-10",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "5.1 Game State & Reset Mechanics"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "State Encapsulation in Hangman Class"
        },
        {
          "type": "code",
          "code": "Now that all standalone utilities are operational, we encapsulate the dynamic round data inside a dedicated Hangman class. This class maintains the active mystery word, guessed letters, and wrong guesses counter."
        },
        {
          "type": "code",
          "code": "Task 10 — Create the Hangman class constructor"
        },
        {
          "type": "code",
          "code": "Initialize the Hangman class attributes and state variables:"
        },
        {
          "type": "paragraph",
          "text": "Think of reserving a blank slate inside an envelope before the mystery word is chosen."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Initialize the secret_word instance variable to an empty string."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Initialize Secret Word Attribute☐  Initialize instance attribute self.secret_word = \"\" (or secretWord = \"\")."
        },
        {
          "type": "paragraph",
          "text": "Think of placing an empty notebook on the desk to track incoming guesses."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Initialize guessed_letters to an empty list or collection."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Initialize Guessed Letters Collection Attribute☐  Initialize instance attribute self.guessed_letters = [] (or empty collection)."
        },
        {
          "type": "paragraph",
          "text": "Think of setting the scoreboard mistake counter to zero before opening kickoff."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Initialize the wrong_guesses integer counter to 0."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Initialize Wrong Guesses Counter Attribute☐  Initialize instance attribute self.wrong_guesses = 0 (or wrongGuesses = 0)."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Hangman State Initialized!"
        },
        {
          "type": "paragraph",
          "text": "You have created the object-oriented state holder:"
        },
        {
          "type": "paragraph",
          "text": "☑  State Encapsulation: Cleanly bundles secret word, guessed letters, and wrong guesses count."
        },
        {
          "type": "paragraph",
          "text": "☑  Safe Initialization: Initializes empty containers and zeroed counters."
        }
      ]
    },
    {
      "id": "hangman-source-page-18",
      "sourcePageStart": 18,
      "sourcePageEnd": 18,
      "sourcePages": [
        18
      ],
      "title": "Task 11 — Implement word selection and game reset",
      "kind": "task",
      "checkpointIndex": 10,
      "checkpointId": "hangman-task-11",
      "taskId": "hangman-task-11",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Select a new random secret word and clear round variables for a fresh match:"
        },
        {
          "type": "paragraph",
          "text": "Think of reaching into a bingo hopper and drawing one secret word at random."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Select a random word from WORDS and assign it to self.secret_word."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Pick Random Word from Word Pool☐  Use the language random generator to choose a random word from WORDS and assign it to secret_word."
        },
        {
          "type": "paragraph",
          "text": "Think of wiping the whiteboard completely clean between matches."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Clear all entries from the guessed_letters collection."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Reset Guessed Letters Collection☐  Clear all elements in guessed_letters so it becomes an empty list."
        },
        {
          "type": "paragraph",
          "text": "Think of resetting the gallows scaffold back to its pristine, empty starting position."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Set self.wrong_guesses = 0."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Reset Wrong Guesses Counter to Zero☐  Set wrong_guesses = 0."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Game Reset & Word Selection Operational!"
        },
        {
          "type": "paragraph",
          "text": "You have implemented dynamic word picking and session reset:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Word Randomization: Picks unpredictable target words from WORDS."
        },
        {
          "type": "paragraph",
          "text": "☑  State Sanitation: Flushes prior match history cleanly."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate game = Hangman() and call reset_game(). Verify game.secret_word in WORDS, len(game.guessed_letters) == 0, and game.wrong_guesses == 0."
        }
      ]
    },
    {
      "id": "hangman-source-page-19",
      "sourcePageStart": 19,
      "sourcePageEnd": 19,
      "sourcePages": [
        19
      ],
      "title": "5.2 Guess Processing & Outcome Resolution",
      "kind": "task",
      "checkpointIndex": 11,
      "checkpointId": "hangman-task-12",
      "taskId": "hangman-task-12",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Registering Letters & Decrementing Lives"
        },
        {
          "type": "paragraph",
          "text": "When a player inputs a valid letter, two actions must occur:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "1.  The letter is added to guessed_letters."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "2.  If the letter is in secret_word, praise the player; if not, increment wrong_guesses and notify the player."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 12 — Implement single guess processing"
        },
        {
          "type": "paragraph",
          "text": "Process an individual letter guess and update game state:"
        },
        {
          "type": "paragraph",
          "text": "Think of logging a contestant's official answer into the match record."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Append the validated letter into self.guessed_letters."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Register Letter in Guessed Letters Collection☐  Append the validated letter parameter to self.guessed_letters."
        },
        {
          "type": "paragraph",
          "text": "Think of celebratory bells ringing when a contestant hits a bullseye."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: If letter is in self.secret_word, print a positive confirmation message."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Branch on Match: Announce Correct Guess☐  If letter in self.secret_word, print \"\\nGood guess! '{letter}' is in the word!\"."
        },
        {
          "type": "paragraph",
          "text": "Think of a warning buzzer sounding while an extra life token is removed."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: If letter is not in self.secret_word, increment self.wrong_guesses by 1 and print an informative miss notice."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Branch on Miss: Increment Wrong Guesses and Announce Miss☐  Otherwise, increment self.wrong_guesses += 1 and print \"\\nSorry! '{letter}' is not in the word.\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Good guess! 'P' is in the word!"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Guess Processing & Lives Deduction Verified!"
        },
        {
          "type": "paragraph",
          "text": "You have implemented round state mutations:"
        },
        {
          "type": "paragraph",
          "text": "☑  Guess Registration: Accurately tracks every player attempt."
        },
        {
          "type": "paragraph",
          "text": "☑  Lives Deduction: Increments mistake counter solely when a wrong letter is supplied."
        },
        {
          "type": "paragraph",
          "text": "☑  Immediate Feedback: Gives instant verbal feedback on success or miss."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Set game.secret_word = \"ROBOT\". Call game.process_guess(\"O\") -> verify game.wrong_guesses == 0. Call game.process_guess(\"Z\") -> verify game.wrong_guesses == 1."
        }
      ]
    },
    {
      "id": "hangman-source-page-20",
      "sourcePageStart": 20,
      "sourcePageEnd": 20,
      "sourcePages": [
        20
      ],
      "title": "Task 13 — Announce outcome and reveal secret word",
      "kind": "task",
      "checkpointIndex": 12,
      "checkpointId": "hangman-task-13",
      "taskId": "hangman-task-13",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Render the final board state and announce whether the player won or ran out of lives:"
        },
        {
          "type": "paragraph",
          "text": "Think of freezing the game field and displaying the final scoreboard for all to see."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Call display_board() with the final state so the full picture is visible."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Render Final Game Board State☐  Call display_board(self.wrong_guesses, self.secret_word, self.guessed_letters) to show the final board appearance."
        },
        {
          "type": "paragraph",
          "text": "Think of crowning a triumphant champion under stadium spotlights."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: If is_word_guessed() returns True, print a celebratory victory proclamation."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Evaluate Victory Condition and Congratulate Player☐  If is_word_guessed() is True, print \"\\nCONGRATULATIONS! You solved the secret word: {self.secret_word}!\"."
        },
        {
          "type": "paragraph",
          "text": "Think of lifting the mystery curtain after time expires to reveal the hidden answer."
        },
        {
          "type": "paragraph",
          "text": "Goal: If lives are exhausted, print a polite game-over message revealing the secret word."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Evaluate Defeat Condition and Reveal Secret Word☐  Otherwise, print \"\\nGAME OVER! You ran out of lives. The secret word was: {self.secret_word}.\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "+---+\n  |   |\n      |\n      |\n      |\n      |\n=========\nWord: P L A N E T\nGuessed letters: A, E, L, N, P, T\nLives remaining: 6 / 6\n\nCONGRATULATIONS! You solved the secret word: PLANET!"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Game Outcome Presentation Operational!"
        },
        {
          "type": "paragraph",
          "text": "You have implemented outcome resolution:"
        },
        {
          "type": "paragraph",
          "text": "☑  Final Board Synchronization: Guarantees the player sees the full completed or failed board."
        },
        {
          "type": "paragraph",
          "text": "☑  Closure & Word Reveal: Always informs the player of the mystery word upon defeat."
        }
      ]
    },
    {
      "id": "hangman-source-page-21",
      "sourcePageStart": 21,
      "sourcePageEnd": 21,
      "sourcePages": [
        21
      ],
      "title": "5.3 Single-Game Turn Loop",
      "kind": "task",
      "checkpointIndex": 13,
      "checkpointId": "hangman-task-14",
      "taskId": "hangman-task-14",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Turn-Based Lifecycle Architecture"
        },
        {
          "type": "paragraph",
          "text": "A single match orchestrates the full turn lifecycle: resetting state, displaying the match banner, and repeatedly presenting the board, reading guesses, and updating state until either the word is solved or 6 mistakes have accumulated."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 14 — Construct single-game turn loop"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Tie all round mechanisms together into play_round():"
        },
        {
          "type": "paragraph",
          "text": "Think of preparing the arena for opening round by clearing the board and drawing a new secret word."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Call self.reset_game() to initialize a fresh round."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Reset Game State for New Match☐  Call self.reset_game() to pick a new secret word and clear counters."
        },
        {
          "type": "paragraph",
          "text": "Think of the master of ceremonies announcing the start of a brand new puzzle game."
        },
        {
          "type": "paragraph",
          "text": "Goal: Output the new game header banner and announce the secret word's letter length."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Print Match Start Banner☐  Print \"\\n===== NEW HANGMAN GAME =====\" and the secret word length indicator."
        },
        {
          "type": "paragraph",
          "text": "Think of rounds ticking by like consecutive innings in a baseball match."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: While wrong_guesses < MAX_LIVES and not is_word_guessed(), display the board, collect a guess, and process it."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Run Turn Loop While Alive and Unsolved☐  While self.wrong_guesses < MAX_LIVES and not is_word_guessed(self.secret_word, self.guessed_letters):☐  Render board via display_board(self.wrong_guesses, self.secret_word, self.guessed_letters), collect guess via get_valid_guess(self.guessed_letters), and process guess via self.process_guess(guess)."
        },
        {
          "type": "paragraph",
          "text": "Think of blowing the final whistle and delivering the official match resolution."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Call self.announce_result() once the gameplay loop terminates."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Call Outcome Announcer☐  After loop exit, call self.announce_result()."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "===== NEW HANGMAN GAME =====\nA secret word has been chosen with 6 letters. Good luck!\n\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========\nWord: _ _ _ _ _ _\nGuessed letters: None\nLives remaining: 6 / 6\n\nEnter your guess (a single letter): e"
        }
      ]
    },
    {
      "id": "hangman-source-page-22",
      "sourcePageStart": 22,
      "sourcePageEnd": 22,
      "sourcePages": [
        22
      ],
      "title": "Good guess! 'E' is in the word!",
      "kind": "information",
      "checkpointIndex": 13,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Single-Game Turn Loop Complete!"
        },
        {
          "type": "paragraph",
          "text": "You have built the complete single-game turn coordinator:"
        },
        {
          "type": "paragraph",
          "text": "☑  Loop Boundary Integrity: Never allows turns past 6 mistakes or after the word is solved."
        },
        {
          "type": "paragraph",
          "text": "☑  Complete Workflow: Orchestrates reset, turn presentation, guess processing, and final announcement."
        }
      ]
    },
    {
      "id": "hangman-source-page-23",
      "sourcePageStart": 23,
      "sourcePageEnd": 23,
      "sourcePages": [
        23
      ],
      "title": "Chapter 6: Adding Replayability & Full Application Execution",
      "kind": "task",
      "checkpointIndex": 14,
      "checkpointId": "hangman-task-15",
      "taskId": "hangman-task-15",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "6.1 Session Management"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Continuous Gaming & Rematch Loops"
        },
        {
          "type": "paragraph",
          "text": "For a polished user experience, players should be able to play multiple games in a single session without having to restart the script from the terminal. We build an interactive rematch prompt and a multi-game session loop."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 15 — Implement rematch prompt"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Ask the player if they wish to play again, validating \"y\" or \"n\":"
        },
        {
          "type": "paragraph",
          "text": "Think of an arcade cabinet flashing \"CONTINUE?\" waiting patiently for player input."
        },
        {
          "type": "paragraph",
          "text": "Goal: Establish an indefinite loop that persists until valid confirmation is received."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Run Interactive Replay Prompt Loop☐  Start a while True loop prompting \"\\nPlay again? (y/n): \"."
        },
        {
          "type": "paragraph",
          "text": "Think of reading the player's response and smoothing away accidental spaces or case differences."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Prompt with \"Play again? (y/n): \", trim whitespace, and lowercase the input."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Read and Normalize Confirmation Input☐  Read user response, strip whitespace, and convert to lowercase."
        },
        {
          "type": "paragraph",
          "text": "Think of flipping the power switch to ON or OFF depending on the player's choice."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Return True for \"y\", False for \"n\", or print \"Please type y or n.\" and re-prompt."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Return Boolean Replay Decision☐  Return True if \"y\"; return False if \"n\"; otherwise print \"Please type y or n.\" and re-prompt."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Play again? (y/n): maybe\nPlease type y or n.\n\nPlay again? (y/n): y"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Rematch Prompt Functional!"
        },
        {
          "type": "paragraph",
          "text": "You have implemented the replay inquiry mechanism:"
        },
        {
          "type": "paragraph",
          "text": "☑  Case-Insensitive Normalization: Accepts upper or lowercase input cleanly."
        },
        {
          "type": "paragraph",
          "text": "☑  Defensive Guard: Politely rejects invalid input and re-prompts without exiting."
        }
      ]
    },
    {
      "id": "hangman-source-page-24",
      "sourcePageStart": 24,
      "sourcePageEnd": 24,
      "sourcePages": [
        24
      ],
      "title": "Task 16 — Construct multi-game session loop",
      "kind": "task",
      "checkpointIndex": 15,
      "checkpointId": "hangman-task-16",
      "taskId": "hangman-task-16",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "Wrap play_round() in a continuous multi-match session controller:"
        },
        {
          "type": "paragraph",
          "text": "Think of an arcade cabinet that stays powered on for as many games as the player desires."
        },
        {
          "type": "paragraph",
          "text": "Goal: Establish an indefinite outer session loop to orchestrate continuous play."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Run Indefinite Session Loop☐  Start an indefinite while True loop in method play_many()."
        },
        {
          "type": "paragraph",
          "text": "Think of loading and playing through one complete puzzle round."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Call self.play_round() to run a full single match from start to finish."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Execute Game Lifecycle☐  Call self.play_round() to run a complete game match."
        },
        {
          "type": "paragraph",
          "text": "Think of consulting the player at the end of each round to see if they wish to continue."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Call self.ask_replay() to evaluate if another game should be launched."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Prompt for Rematch Confirmation☐  Call not self.ask_replay() to evaluate if the player wishes to stop."
        },
        {
          "type": "paragraph",
          "text": "Think of waving goodbye and thanking guests as they step outside the game center."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: If the player declines replay, print \"Thanks for playing Hangman!\" and break the loop."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Print Session Farewell on Exit☐  Print \"\\nThanks for playing Hangman!\" and break out of the session loop."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Play again? (y/n): n\nThanks for playing Hangman!"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Multi-Game Session Engine Complete!"
        },
        {
          "type": "paragraph",
          "text": "You have completed the multi-round gameplay coordinator:"
        },
        {
          "type": "paragraph",
          "text": "☑  Continuous Play: Supports back-to-back puzzle rounds without restarting the program."
        },
        {
          "type": "paragraph",
          "text": "☑  Clean Termination: Breaks out cleanly and prints a parting farewell."
        }
      ]
    },
    {
      "id": "hangman-source-page-25",
      "sourcePageStart": 25,
      "sourcePageEnd": 25,
      "sourcePages": [
        25
      ],
      "title": "6.2 Application Assembly",
      "kind": "task",
      "checkpointIndex": 16,
      "checkpointId": "hangman-task-17",
      "taskId": "hangman-task-17",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Program Inception & Launch Pipeline"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "With all classes, helpers, and state loops complete, the final step is to assemble the main() entry function to greet the user, instantiate the game engine, and launch the session."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 17 — Assemble the main() entry point"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Wire the entire application together inside main():"
        },
        {
          "type": "paragraph",
          "text": "Think of switching on the arena marquee lights to greet visitors."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Call print_welcome() to render the official application title."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Call Welcome Banner Function☐  Invoke print_welcome() (or printWelcome())."
        },
        {
          "type": "paragraph",
          "text": "Think of deploying the game director to take charge of the tournament."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Create a new instance of the Hangman class."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Instantiate Hangman Game Manager☐  Create an instance of Hangman named game."
        },
        {
          "type": "paragraph",
          "text": "Think of handing over the microphone and opening play to the contestants."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Call game.play_many() to commence the continuous game session."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Launch Multi-Game Session Loop☐  Call game.play_many() (or game.playMany()) and add standard script execution guards."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Welcome to Hangman!\n\n===== NEW HANGMAN GAME =====\nA secret word has been chosen with 6 letters. Good luck!"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Milestone Checkpoint: Full Application Experience Achieved!"
        },
        {
          "type": "paragraph",
          "text": "You have completed the entire Hangman architecture:"
        },
        {
          "type": "paragraph",
          "text": "☑  Unified Architecture: All 17 tasks and 49 steps wired into a cohesive, production-grade CLI game."
        },
        {
          "type": "paragraph",
          "text": "☑  Tri-Language Parity: Identical operational logic and structure across Python, C++, and Java."
        },
        {
          "type": "paragraph",
          "text": "☑  Complete Polish: Defensive input parsing, ASCII art visualization, and seamless replay loops."
        }
      ]
    },
    {
      "id": "hangman-source-page-26",
      "sourcePageStart": 26,
      "sourcePageEnd": 26,
      "sourcePages": [
        26
      ],
      "title": "Chapter 7: Reflect & Expand",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "7.1 What You Have Built"
        },
        {
          "type": "paragraph",
          "text": "You have designed and constructed an interactive, object-oriented Hangman application from scratch. Take a moment to review the software engineering patterns and algorithmic foundations you practiced:"
        },
        {
          "type": "table",
          "columns": [
            "Feature Dimension",
            "Implementation Technique",
            "Educational Value"
          ],
          "rows": [
            [
              "Constants & Boundaries",
              "WORDS, MAX_LIVES, STAGES",
              "Eliminates hard-coded magic values; centralizes game difficulty configuration."
            ],
            [
              "String Masking",
              "Dynamic character-by-character evaluation",
              "Teaches string concatenation, list filtering, and membership checks."
            ],
            [
              "Defensive Input",
              "3-stage validation pipeline (read, format, duplicates)",
              "Guards CLI applications against crashes caused by malformed user input."
            ],
            [
              "Terminal Graphics",
              "Progressive ASCII art stages",
              "Visualizes numeric state changes into intuitive graphical representations."
            ],
            [
              "OOP Encapsulation",
              "Hangman class with instance state",
              "Separates persistent round state from stateless functional utilities."
            ],
            [
              "Interactive Loops",
              "Multi-game replay coordinator",
              "Demonstrates session management and continuous interactive user loops."
            ]
          ]
        }
      ]
    },
    {
      "id": "hangman-source-page-27",
      "sourcePageStart": 27,
      "sourcePageEnd": 27,
      "sourcePages": [
        27
      ],
      "title": "7.2 Extension Ideas",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Now that you have a functioning game engine, consider challenging yourself with these creative extensions:"
        },
        {
          "type": "paragraph",
          "text": "1.  Difficulty Settings: Add easy (8 lives), medium (6 lives), and hard (4 lives) modes with different word lists."
        },
        {
          "type": "paragraph",
          "text": "2.  Category Selection: Allow players to pick word topics (such as Animals, Countries, Programming Languages, or Science)."
        },
        {
          "type": "paragraph",
          "text": "3.  High Score Tracker: Save win streaks and best completion times to a local JSON file across sessions."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "4.  Hint System: Allow the player to type \"?\" to reveal a single random unsolved letter at the cost of 2 lives."
        }
      ]
    },
    {
      "id": "hangman-source-page-28",
      "sourcePageStart": 28,
      "sourcePageEnd": 28,
      "sourcePages": [
        28
      ],
      "title": "7.3 Share What You Built! Time to Showcase Your Project!",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Congratulations on completing Project 3! You now have a complete, polished portfolio project that demonstrates your understanding of object-oriented design and defensive programming."
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Push your repository to GitHub with a clean README.md and screenshot recordings.",
            "Share your code with fellow learners and explain how your 3-stage input pipeline prevents invalid character crashes.",
            "Explore running your implementation in Python, C++, and Java to appreciate the syntactic strengths of each language."
          ]
        }
      ]
    },
    {
      "id": "hangman-source-page-29",
      "sourcePageStart": 29,
      "sourcePageEnd": 29,
      "sourcePages": [
        29
      ],
      "title": "Appendix: Full Pseudocode Reference",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "Complete Tri-Language Algorithmic Logic"
        },
        {
          "type": "code",
          "code": "PROGRAM HangmanGame:\n    CONSTANT WORDS = [\"PYTHON\", \"PLANET\", \"ROBOT\", \"GUITAR\", \"SILVER\", \"ROCKET\", \"CODING\"]\n    CONSTANT MAX_LIVES = 6\n    CONSTANT STAGES = [7 ASCII art strings for mistakes 0 through 6]\n\n    FUNCTION print_welcome():\n        OUTPUT \"Welcome to Hangman!\"\n\n    FUNCTION get_masked_word(secret_word, guessed_letters):\n        SET display_chars = []\n        FOR EACH letter IN secret_word:\n            IF letter IN guessed_letters THEN\n                APPEND letter TO display_chars\n            ELSE\n                APPEND \"_\" TO display_chars\n            END IF\n        END FOR\n        RETURN JOIN display_chars WITH \" \"\n\n    FUNCTION is_word_guessed(secret_word, guessed_letters):\n        FOR EACH letter IN secret_word:\n            IF letter NOT IN guessed_letters THEN\n                RETURN False\n            END IF\n        END FOR\n        RETURN True\n\n    FUNCTION format_guessed_letters(guessed_letters):\n        IF guessed_letters IS EMPTY THEN\n            RETURN \"None\"\n        END IF\n        SET sorted_letters = SORT(guessed_letters)\n        RETURN JOIN sorted_letters WITH \", \"\n\n    FUNCTION display_board(wrong_guesses, secret_word, guessed_letters):\n        OUTPUT STAGES[wrong_guesses]\n        OUTPUT \"Word: \" + get_masked_word(secret_word, guessed_letters)\n        OUTPUT \"Guessed letters: \" + format_guessed_letters(guessed_letters)\n        SET lives_left = MAX_LIVES - wrong_guesses\n        OUTPUT \"Lives remaining: \" + lives_left + \" / \" + MAX_LIVES\n\n    FUNCTION read_raw_guess():\n        PROMPT \"\\nEnter your guess (a single letter): \"\n        READ user_input\n        RETURN TRIM(UPPERCASE(user_input))\n\n    FUNCTION is_valid_format(guess):\n        RETURN LENGTH(guess) == 1 AND IS_ALPHA(guess)\n\n    FUNCTION get_valid_guess(guessed_letters):\n        WHILE True:\n            SET guess = read_raw_guess()\n            IF NOT is_valid_format(guess) THEN\n                OUTPUT \"Invalid input. Please enter exactly one alphabetic letter (A-Z).\"\n            ELSE IF guess IN guessed_letters THEN\n                OUTPUT \"You already guessed '\" + guess + \"'. Try a different letter.\"\n            ELSE\n                RETURN guess"
        }
      ]
    },
    {
      "id": "hangman-source-page-30",
      "sourcePageStart": 30,
      "sourcePageEnd": 30,
      "sourcePages": [
        30
      ],
      "title": "Source page 30",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "END IF\n        END WHILE\n\n    CLASS Hangman:\n        CONSTRUCTOR:\n            SET self.secret_word = \"\"\n            SET self.guessed_letters = []\n            SET self.wrong_guesses = 0\n\n        METHOD reset_game():\n            SET self.secret_word = RANDOM_CHOICE(WORDS)\n            SET self.guessed_letters = []\n            SET self.wrong_guesses = 0\n\n        METHOD process_guess(letter):\n            APPEND letter TO self.guessed_letters\n            IF letter IN self.secret_word THEN\n                OUTPUT \"Good guess! '\" + letter + \"' is in the word!\"\n            ELSE\n                SET self.wrong_guesses = self.wrong_guesses + 1\n                OUTPUT \"Sorry! '\" + letter + \"' is not in the word.\"\n            END IF\n\n        METHOD announce_result():\n            CALL display_board(self.wrong_guesses, self.secret_word, self.guessed_letters)\n            IF is_word_guessed(self.secret_word, self.guessed_letters) THEN\n                OUTPUT \"CONGRATULATIONS! You solved the secret word: \" + self.secret_word + \"!\"\n            ELSE\n                OUTPUT \"GAME OVER! You ran out of lives. The secret word was: \" + self.secret_word + \".\"\n            END IF\n\n        METHOD play_round():\n            CALL self.reset_game()\n            OUTPUT \"===== NEW HANGMAN GAME =====\"\n            OUTPUT \"A secret word has been chosen with \" + LENGTH(self.secret_word) + \" letters. Good luck!\"\n            WHILE self.wrong_guesses < MAX_LIVES AND NOT is_word_guessed(self.secret_word, self.guessed_letters):\n                CALL display_board(self.wrong_guesses, self.secret_word, self.guessed_letters)\n                SET guess = CALL get_valid_guess(self.guessed_letters)\n                CALL self.process_guess(guess)\n            END WHILE\n            CALL self.announce_result()\n\n        METHOD ask_replay():\n            WHILE True:\n                PROMPT \"Play again? (y/n): \"\n                READ answer\n                SET normalized = TRIM(LOWERCASE(answer))\n                IF normalized == \"y\" THEN\n                    RETURN True\n                ELSE IF normalized == \"n\" THEN\n                    RETURN False\n                ELSE\n                    OUTPUT \"Please type y or n.\"\n                END IF\n            END WHILE\n\n        METHOD play_many():\n            WHILE True:\n                CALL self.play_round()"
        }
      ]
    },
    {
      "id": "hangman-source-page-31",
      "sourcePageStart": 31,
      "sourcePageEnd": 31,
      "sourcePages": [
        31
      ],
      "title": "Source page 31",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "IF NOT self.ask_replay() THEN\n                    OUTPUT \"Thanks for playing Hangman!\"\n                    BREAK\n                END IF\n            END WHILE\n\n    FUNCTION main():\n        CALL print_welcome()\n        SET game = NEW Hangman()\n        CALL game.play_many()\n\nEND PROGRAM"
        }
      ]
    }
  ],
  "stone-paper-scissors": [
    {
      "id": "stone-paper-scissors-source-page-01",
      "sourcePageStart": 1,
      "sourcePageEnd": 1,
      "sourcePages": [
        1
      ],
      "title": "Stone Paper Scissors Game",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "Chapter 1: Introduction"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "1.1 Getting Started"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Meet Your Project"
        },
        {
          "type": "paragraph",
          "text": "You are about to build Stone Paper Scissors — the world-famous hand game — as an interactive command-line application where you face off directly against the System (Computer Opponent)."
        },
        {
          "type": "paragraph",
          "text": "This project strengthens your core foundational programming skills: working with collections and lists, handling user input validation, generating randomized computer moves, modeling classes with inheritance, and managing a multi-round match engine."
        },
        {
          "type": "paragraph",
          "text": "Once finished, you will have a complete, polished match-based CLI game where you compete round-by-round to reach 3 points, watch moves get revealed in real time, view a live scoreboard, and play rematches without restarting the application."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-02",
      "sourcePageStart": 2,
      "sourcePageEnd": 2,
      "sourcePages": [
        2
      ],
      "title": "What You Will Learn",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You will build this application from start to finish. By the end, you will have a clean, tested project you can run, explain, and share."
        },
        {
          "type": "paragraph",
          "text": "You will learn how to:"
        },
        {
          "type": "paragraph",
          "text": "1.  Represent game moves and configuration using immutable constants and collections"
        },
        {
          "type": "paragraph",
          "text": "2.  Encapsulate multi-value outcomes inside dedicated data models"
        },
        {
          "type": "paragraph",
          "text": "3.  Validate user input defensively to accept numeric codes and string aliases without crashing"
        },
        {
          "type": "paragraph",
          "text": "4.  Generate unpredictable computer moves using standard language pseudo-random number generators"
        },
        {
          "type": "paragraph",
          "text": "5.  Compare choices using clean, beginner-friendly decision trees to determine round winners with descriptive victory reasons"
        },
        {
          "type": "paragraph",
          "text": "6.  Drive a best-of-5 target score match loop that tracks points until a player reaches the threshold"
        },
        {
          "type": "paragraph",
          "text": "7.  Render a formatted ASCII scoreboard card after every round"
        },
        {
          "type": "paragraph",
          "text": "8.  Implement rematch loops so players can replay consecutive matches seamlessly"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-03",
      "sourcePageStart": 3,
      "sourcePageEnd": 3,
      "sourcePages": [
        3
      ],
      "title": "What You Need",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Before you begin, make sure you are comfortable with:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Printing output and reading keyboard input",
            "Variables, conditionals (if / else), and loops (while)",
            "Basic functions and methods",
            "Lists or arrays",
            "Creating simple classes and objects",
            "Basic use of your language's random-number utilities"
          ]
        },
        {
          "type": "code",
          "code": "This project is tailored specifically for beginners, guiding you step by step through every class and function with simple, intuitive code."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-04",
      "sourcePageStart": 4,
      "sourcePageEnd": 4,
      "sourcePages": [
        4
      ],
      "title": "1.2 Starting with Small Steps",
      "kind": "task",
      "checkpointIndex": 0,
      "checkpointId": "stone-paper-scissors-task-1",
      "taskId": "stone-paper-scissors-task-1",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "First Steps into Code: The Welcome Banner"
        },
        {
          "type": "paragraph",
          "text": "Every software project begins with a single step. Before constructing complex match loops or move-evaluation logic, we first establish our project entry file and verify that our execution environment is properly wired."
        },
        {
          "type": "paragraph",
          "text": "To do this, we create our entry point and print a clean welcome banner to confirm that the environment is operational."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 1 — Create the entry file and print welcome message"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Create your project entry file and implement print_welcome() (or printWelcome()):"
        },
        {
          "type": "paragraph",
          "text": "Think of laying down the welcome mat at the front door of a game parlor."
        },
        {
          "type": "paragraph",
          "text": "Goal: Establish the execution root and prepare the script environment."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Entry File Setup☐  Create your project file (StonePaperScissors.py, StonePaperScissors.cpp, or StonePaperScissors.java) and import required system modules."
        },
        {
          "type": "paragraph",
          "text": "Think of switching on an electronic arcade cabinet that lights up its title screen."
        },
        {
          "type": "paragraph",
          "text": "Goal: Provide immediate visual confirmation that the application is running."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Welcome Banner Output☐  Print the welcome message string: \"Welcome to Stone Paper Scissors!\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Welcome to Stone Paper Scissors!"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-05",
      "sourcePageStart": 5,
      "sourcePageEnd": 5,
      "sourcePages": [
        5
      ],
      "title": "Milestone Checkpoint: Welcome Banner Functional!",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established the project entry point:"
        },
        {
          "type": "paragraph",
          "text": "☑  Entry File Created: Initialized the project source file and confirmed compiler execution."
        },
        {
          "type": "paragraph",
          "text": "☑  Greeting Banner Verified: Successfully printed the welcome banner to the terminal."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call print_welcome() (or printWelcome()) directly from your main execution block. Verify that \"Welcome to Stone Paper Scissors!\" prints cleanly to the console."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-06",
      "sourcePageStart": 6,
      "sourcePageEnd": 6,
      "sourcePages": [
        6
      ],
      "title": "Move Representation & Scoring Boundaries",
      "kind": "task",
      "checkpointIndex": 1,
      "checkpointId": "stone-paper-scissors-task-2",
      "taskId": "stone-paper-scissors-task-2",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "In Stone Paper Scissors, the game operates on a closed set of three valid choices: \"Stone\", \"Paper\", and \"Scissors\". Additionally, a match is played to a fixed target score (first to 3 points)."
        },
        {
          "type": "paragraph",
          "text": "Rather than hardcoding string literals and magic numbers throughout multiple functions, professional developers define these values as global constants at the top of the file. This makes the rules easy to configure and eliminates typographical errors."
        },
        {
          "type": "table",
          "columns": [
            "Constant",
            "Value / Definition",
            "Purpose"
          ],
          "rows": [
            [
              "MOVES",
              "[\"Stone\", \"Paper\", \"Scissors\"]",
              "Valid canonical move choices"
            ],
            [
              "TARGET_SCORE",
              "3",
              "Points needed to win the match (first to 3)"
            ]
          ]
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 2 — Define valid moves and target score"
        },
        {
          "type": "paragraph",
          "text": "Declare the global constants representing valid moves and the match victory boundary:"
        },
        {
          "type": "paragraph",
          "text": "Think of defining the official rulebook parameters before starting the game."
        },
        {
          "type": "paragraph",
          "text": "Goal: Prevent magic numbers and string typos by storing configuration centrally."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Declare Move Collection☐  Declare a constant list/vector/array named MOVES containing \"Stone\", \"Paper\", and \"Scissors\" in that order."
        },
        {
          "type": "paragraph",
          "text": "Think of setting the point limit on a digital scoreboard."
        },
        {
          "type": "paragraph",
          "text": "Goal: Establish the victory threshold needed to win a competitive match."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Declare Target Score Threshold☐  Declare an integer constant named TARGET_SCORE set to 3."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-07",
      "sourcePageStart": 7,
      "sourcePageEnd": 7,
      "sourcePages": [
        7
      ],
      "title": "Milestone Checkpoint: Game Configuration Defined!",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established the core domain rules:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Move Pool Defined: Declared MOVES containing the three canonical move strings."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Target Boundary Fixed: Declared TARGET_SCORE = 3 without magic numbers."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Print the length of MOVES and the value of TARGET_SCORE. Verify that len(MOVES) (or MOVES.size()) is 3 and TARGET_SCORE is 3."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-08",
      "sourcePageStart": 8,
      "sourcePageEnd": 8,
      "sourcePages": [
        8
      ],
      "title": "Chapter 2: Specifications & Architectural Plan",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "2.1 Understanding the Domain & Rules"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Move Hierarchy & Win Justifications"
        },
        {
          "type": "paragraph",
          "text": "Stone Paper Scissors is played between two opponents: the Human Player and the System. In each round, both opponents simultaneously choose one of three valid moves."
        },
        {
          "type": "paragraph",
          "text": "The game rules form a directed cycle where each move defeats exactly one other move and loses to exactly one other move:"
        },
        {
          "type": "paragraph",
          "text": "/"
        },
        {
          "type": "paragraph",
          "text": "The outcomes are governed by three immutable rules:"
        },
        {
          "type": "table",
          "columns": [
            "Player Move",
            "System Move",
            "Winner",
            "Winning Reason"
          ],
          "rows": [
            [
              "Stone",
              "Scissors",
              "Player",
              "Stone crushes Scissors"
            ],
            [
              "Scissors",
              "Paper",
              "Player",
              "Scissors cuts Paper"
            ],
            [
              "Paper",
              "Stone",
              "Player",
              "Paper covers Stone"
            ],
            [
              "Scissors",
              "Stone",
              "System",
              "Stone crushes Scissors"
            ],
            [
              "Paper",
              "Scissors",
              "System",
              "Scissors cuts Paper"
            ],
            [
              "Stone",
              "Paper",
              "System",
              "Paper covers Stone"
            ],
            [
              "Identical",
              "Identical",
              "Draw",
              "Both chose <Move>"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "If both opponents select the exact same move, the round is a Draw (Tie), and neither opponent receives a point."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Match Format: Best-of-5 Target Score"
        },
        {
          "type": "paragraph",
          "text": "Rather than playing a single throwaway round, a match is played in a competitive first-to-3 points format:"
        },
        {
          "type": "image",
          "src": "/assets/projects/guides/stone-paper-scissors/image1.png",
          "alt": "Stone Paper Scissors game flow diagram",
          "caption": "Stone Paper Scissors game flow diagram"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-09",
      "sourcePageStart": 9,
      "sourcePageEnd": 9,
      "sourcePages": [
        9
      ],
      "title": "•  The first opponent to win 3 points wins the entire match.",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Rounds continue until either the player or the system reaches 3 points.",
            "Draws award zero points to both sides, so matches can take 3, 4, 5, or more rounds until a champion emerges."
          ]
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-10",
      "sourcePageStart": 10,
      "sourcePageEnd": 10,
      "sourcePages": [
        10
      ],
      "title": "2.2 Chronological Execution Flow",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Five-Stage Match Execution Lifecycle"
        },
        {
          "type": "paragraph",
          "text": "Chronologically, a complete application session proceeds through five distinct stages:"
        },
        {
          "type": "paragraph",
          "text": "/"
        },
        {
          "type": "paragraph",
          "text": "1.  System Inception & Greeting: Launch the program, display the executive welcome banner, and prompt the player for their name."
        },
        {
          "type": "paragraph",
          "text": "2.  Opponent Initialization: Instantiate human and automated computer contestants with fresh score tallies of zero."
        },
        {
          "type": "paragraph",
          "text": "3.  Turn-Based Round Engine: Continuously collect moves, validate human keyboard input, pick randomized computer moves, and reveal selections simultaneously."
        },
        {
          "type": "paragraph",
          "text": "4.  Referee Evaluation & Scoreboard: Compare choices using immutable rule decision trees, update scores, and display the live ASCII scoreboard card."
        },
        {
          "type": "paragraph",
          "text": "5.  Match Resolution & Replay: Crown the first contestant to reach 3 points and invite players to rematch without restarting the application."
        },
        {
          "type": "image",
          "src": "/assets/projects/guides/stone-paper-scissors/image2.png",
          "alt": "Stone Paper Scissors program structure diagram",
          "caption": "Stone Paper Scissors program structure diagram"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-11",
      "sourcePageStart": 11,
      "sourcePageEnd": 11,
      "sourcePages": [
        11
      ],
      "title": "2.3 System Architecture: Thinking in OOP",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Component Responsibilities & Class Hierarchy"
        },
        {
          "type": "paragraph",
          "text": "Splitting the system into discrete classes isolates responsibilities and makes the code modular, intuitive, and testable:"
        },
        {
          "type": "paragraph",
          "text": "/"
        },
        {
          "type": "table",
          "columns": [
            "Component",
            "Responsibility"
          ],
          "rows": [
            [
              "RoundResult",
              "Bundles the evaluation outcome into structured fields (winner and reason)."
            ],
            [
              "Player",
              "Stores the player's name and score. Prompts the human user for a validated move choice and resets score between matches."
            ],
            [
              "SystemPlayer",
              "Inherits from Player. Overrides the move selection method to generate the computer's move randomly from MOVES."
            ],
            [
              "Game",
              "Holds the Player and SystemPlayer instances, manages the target score (3), executes individual rounds, prints the scoreboard, and controls the match and replay loops."
            ]
          ]
        },
        {
          "type": "image",
          "src": "/assets/projects/guides/stone-paper-scissors/image3.png",
          "alt": "Stone Paper Scissors rules diagram",
          "caption": "Stone Paper Scissors rules diagram"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-12",
      "sourcePageStart": 12,
      "sourcePageEnd": 12,
      "sourcePages": [
        12
      ],
      "title": "Chapter 3: Core Domain Models & Move Comparison Logic",
      "kind": "task",
      "checkpointIndex": 2,
      "checkpointId": "stone-paper-scissors-task-3",
      "taskId": "stone-paper-scissors-task-3",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "3.1 Round Outcome Modeling"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Structured Results: The RoundResult Data Model"
        },
        {
          "type": "paragraph",
          "text": "When evaluating a round between two moves, a function must communicate two distinct pieces of information:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "1.  Who Won: \"draw\", \"player\", or \"system\"."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "2.  The Justification: A descriptive explanation, such as \"Stone crushes Scissors\" or \"Both chose Paper\"."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "In beginner programming, passing loose values or ad-hoc strings quickly creates confusion. By bundling these two fields into a dedicated RoundResult model, all three programming languages maintain an identical, clean data structure."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 3 — Create the RoundResult model"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Define the RoundResult data model to bundle evaluation outcome fields:"
        },
        {
          "type": "paragraph",
          "text": "Think of an official judge's scorecard that records both the decision and the justification."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Store the outcome winner identifier (\"draw\", \"player\", or \"system\")."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Initialize Winner Identifier☐  Store the winner identifier parameter into an instance field named winner."
        },
        {
          "type": "paragraph",
          "text": "Think of writing the referee's explanatory note on the scorecard."
        },
        {
          "type": "paragraph",
          "text": "Goal: Store the plain-English explanation for why that outcome occurred."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Initialize Outcome Reason☐  Store the reason description parameter into an instance field named reason."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-13",
      "sourcePageStart": 13,
      "sourcePageEnd": 13,
      "sourcePages": [
        13
      ],
      "title": "Milestone Checkpoint: Outcome Data Model Established!",
      "kind": "information",
      "checkpointIndex": 2,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have encapsulated round outcome state:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Data Model Created: Defined RoundResult with winner and reason fields."
        },
        {
          "type": "paragraph",
          "text": "☑  Encapsulation Verified: Confirmed that outcome properties are grouped into a cohesive entity."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate a test object res = RoundResult(\"player\", \"Stone crushes Scissors\"). Verify that res.winner equals \"player\" and res.reason equals \"Stone crushes Scissors\"."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-14",
      "sourcePageStart": 14,
      "sourcePageEnd": 14,
      "sourcePages": [
        14
      ],
      "title": "3.2 Rule-Based Evaluation Engine",
      "kind": "task",
      "checkpointIndex": 3,
      "checkpointId": "stone-paper-scissors-task-4",
      "taskId": "stone-paper-scissors-task-4",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Decision Trees: Exhaustive Outcome Evaluation"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Before building classes or handling user input, we need an algorithmic evaluation function that takes two move strings (player_move, system_move) and returns a RoundResult."
        },
        {
          "type": "paragraph",
          "text": "The evaluation follows three logical branches:"
        },
        {
          "type": "paragraph",
          "text": "1.  Equal Moves: If both opponents pick identical moves, it is always a draw."
        },
        {
          "type": "paragraph",
          "text": "2.  Player Wins: Check the three winning combinations:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Stone crushes Scissors",
            "Scissors cuts Paper",
            "Paper covers Stone"
          ]
        },
        {
          "type": "paragraph",
          "text": "3.  System Wins: If it is neither a draw nor a player win, the system opponent wins with the matching justification."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 4 — Implement determineWinner(playerMove, systemMove)"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement the rule comparison function determine_winner(player_move, system_move) (or determineWinner(playerMove, systemMove)):"
        },
        {
          "type": "paragraph",
          "text": "Think of checking if both participants revealed matching cards."
        },
        {
          "type": "paragraph",
          "text": "Goal: Handle ties immediately before checking asymmetric win conditions."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Check Draw Condition☐  Check if player_move == system_move. If true, return a RoundResult with winner \"draw\" and reason \"Both chose \" + player_move."
        },
        {
          "type": "paragraph",
          "text": "Think of verifying if the player's move trumps the computer's move."
        },
        {
          "type": "paragraph",
          "text": "Goal: Check the three winning permutations for the human player."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Check Player Victory Conditions☐  Check player victory combinations:– If player chose \"Stone\" and system chose \"Scissors\", return winner \"player\" and reason \"Stone crushes Scissors\".– If player chose \"Scissors\" and system chose \"Paper\", return winner \"player\" and reason \"Scissors cuts Paper\".– If player chose \"Paper\" and system chose \"Stone\", return winner \"player\" and reason \"Paper covers Stone\"."
        },
        {
          "type": "paragraph",
          "text": "Think of resolving the remaining matchups where the computer wins."
        },
        {
          "type": "paragraph",
          "text": "Goal: Check system victory combinations and return the corresponding reason."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Check System Victory Conditions☐  Check system victory combinations:– If system chose \"Stone\" and player chose \"Scissors\", return winner \"system\" and reason \"Stone crushes Scissors\".– If system chose \"Scissors\" and player chose \"Paper\", return winner \"system\" and reason \"Scissors cuts Paper\".– Otherwise, return winner \"system\" and reason \"Paper covers Stone\"."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-15",
      "sourcePageStart": 15,
      "sourcePageEnd": 15,
      "sourcePages": [
        15
      ],
      "title": "Milestone Checkpoint: Rules & Evaluation Engine Operational!",
      "kind": "information",
      "checkpointIndex": 3,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed the core mathematical comparison logic:"
        },
        {
          "type": "paragraph",
          "text": "☑  9-Outcome Matrix Covered: Exhaustively evaluated all 3 ties, 3 player wins, and 3 system wins."
        },
        {
          "type": "paragraph",
          "text": "☑  Descriptive Justifications: Every outcome returns its real-world justification."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call determine_winner(\"Stone\", \"Scissors\") and verify winner == \"player\". Call determine_winner(\"Paper\", \"Paper\") and verify winner == \"draw\". Call determine_winner(\"Paper\", \"Scissors\") and verify winner == \"system\"."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-16",
      "sourcePageStart": 16,
      "sourcePageEnd": 16,
      "sourcePages": [
        16
      ],
      "title": "Chapter 4: Modeling Opponents (Human & System)",
      "kind": "task",
      "checkpointIndex": 4,
      "checkpointId": "stone-paper-scissors-task-5",
      "taskId": "stone-paper-scissors-task-5",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "4.1 Entity Modeling & Score Tracking"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "State Encapsulation: The Player Entity"
        },
        {
          "type": "code",
          "code": "Every participant in the game needs an identity and a way to track points. A Player class encapsulates these fields:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "name: A string identifier (defaulting to \"Player\" if blank).",
            "score: An integer tracking points earned in the active match (starts at 0).",
            "reset_score(): A helper method to zero out points when starting a rematch."
          ]
        },
        {
          "type": "code",
          "code": "Task 5 — Create the Player class constructor"
        },
        {
          "type": "code",
          "code": "Create the Player class and its constructor:"
        },
        {
          "type": "paragraph",
          "text": "Think of writing a player's name tag before they enter the tournament."
        },
        {
          "type": "paragraph",
          "text": "Goal: Ensure every player has a clean, non-empty display name."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Sanitize Player Name☐  Accept a raw name string in the constructor. Trim leading and trailing whitespace. If empty or blank, default it to \"Player\"."
        },
        {
          "type": "paragraph",
          "text": "Think of clearing the scoreboard counter before the match starts."
        },
        {
          "type": "paragraph",
          "text": "Goal: Initialize the participant's score to zero."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Initialize Starting Score☐  Set self.score = 0 (or score = 0)."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-17",
      "sourcePageStart": 17,
      "sourcePageEnd": 17,
      "sourcePages": [
        17
      ],
      "title": "Milestone Checkpoint: Player Entity Initialized!",
      "kind": "information",
      "checkpointIndex": 4,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have encapsulated basic player state:"
        },
        {
          "type": "paragraph",
          "text": "☑  Name Sanitization: Handled whitespace trimming and blank name fallback."
        },
        {
          "type": "paragraph",
          "text": "☑  Score Counter: Initialized starting score to 0."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate p1 = Player(\"  Alex  \") and p2 = Player(\"\"). Verify that p1.name == \"Alex\", p2.name == \"Player\", and both have score == 0."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-18",
      "sourcePageStart": 18,
      "sourcePageEnd": 18,
      "sourcePages": [
        18
      ],
      "title": "Match Reset Mechanics",
      "kind": "task",
      "checkpointIndex": 5,
      "checkpointId": "stone-paper-scissors-task-6",
      "taskId": "stone-paper-scissors-task-6",
      "blocks": [
        {
          "type": "paragraph",
          "text": "When players finish a match and agree to a rematch, their scores must be reset to zero without destroying and re-instantiating the object. Providing an explicit reset method keeps state management clean."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 6 — Implement score reset on Player"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Add reset_score() (or resetScore()) to Player:"
        },
        {
          "type": "paragraph",
          "text": "Think of wiping a physical chalkboard tally back to zero for a new match."
        },
        {
          "type": "paragraph",
          "text": "Goal: Reset the player's accumulated score back to 0."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Zero Out Score☐  Set self.score = 0 (or score = 0)."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-19",
      "sourcePageStart": 19,
      "sourcePageEnd": 19,
      "sourcePages": [
        19
      ],
      "title": "Milestone Checkpoint: Player Reset Capability Verified!",
      "kind": "information",
      "checkpointIndex": 5,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented score reset mechanics:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Reset Method Added: Created reset_score() to clear point tallies."
        },
        {
          "type": "paragraph",
          "text": "☑  Rematch Readiness: Enabled seamless multi-match score resetting."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Set p = Player(\"Alex\"), manually set p.score = 2, call p.reset_score(), and assert that p.score == 0."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-20",
      "sourcePageStart": 20,
      "sourcePageEnd": 20,
      "sourcePages": [
        20
      ],
      "title": "4.2 Input Validation & Computer Move Generation",
      "kind": "task",
      "checkpointIndex": 6,
      "checkpointId": "stone-paper-scissors-task-7",
      "taskId": "stone-paper-scissors-task-7",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Defensive Programming: CLI Input Validation"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "A common failure in beginner console applications is crashing when a user types an unexpected input. What if the user types \"stone\" in lowercase, enters \"2\", or types a typo like \"abc\"?"
        },
        {
          "type": "paragraph",
          "text": "Our move selection method must be resilient:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "It presents numbered options: [1] Stone, [2] Paper, [3] Scissors.",
            "It accepts numeric digits (\"1\", \"2\", \"3\") OR move name aliases (\"stone\", \"paper\", \"scissors\").",
            "If the user enters an invalid value, the application displays a friendly warning and loops back to re-prompt without crashing."
          ]
        },
        {
          "type": "table",
          "columns": [
            "User Input Format",
            "Accepted Examples",
            "Canonical Move Resolved",
            "System Behavior"
          ],
          "rows": [
            [
              "Numeric Code",
              "\"1\", \"2\", \"3\"",
              "\"Stone\", \"Paper\", \"Scissors\"",
              "Accepts and returns move"
            ],
            [
              "Full Name Alias",
              "\"stone\", \"paper\", \"scissors\"",
              "\"Stone\", \"Paper\", \"Scissors\"",
              "Case-normalized and accepted"
            ],
            [
              "Invalid Entry",
              "\"4\", \"abc\", \"\"",
              "None",
              "Displays warning and re-prompts"
            ]
          ]
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 7 — Implement validated human move input"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Add choose_move() (or chooseMove()) to Player:"
        },
        {
          "type": "paragraph",
          "text": "Think of a turnstile that keeps waiting until a valid token is inserted."
        },
        {
          "type": "paragraph",
          "text": "Goal: Keep prompting the human user until a valid move choice is received."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Interactive Prompt Loop☐  Run an indefinite loop (while True / while (true))."
        },
        {
          "type": "paragraph",
          "text": "Think of handing the player a menu card with clear options."
        },
        {
          "type": "paragraph",
          "text": "Goal: Present the available moves and prompt for input."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Display Choice Menu☐  Print the choice menu displaying the player name and numbered options for [1] Stone, [2] Paper, and [3] Scissors, prompting with \"Enter choice (1-3): \"."
        },
        {
          "type": "paragraph",
          "text": "Think of cleaning off dirt from an input coin before checking it."
        },
        {
          "type": "paragraph",
          "text": "Goal: Normalize the input string by trimming whitespace and converting to lowercase."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Read and Normalize Input☐  Read the user's input line, strip whitespace, and convert it to lowercase."
        },
        {
          "type": "paragraph",
          "text": "Think of checking if the input matches any known currency."
        },
        {
          "type": "paragraph",
          "text": "Goal: Map numeric keys and aliases to canonical move strings."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Validate and Map Choices☐  Evaluate the input:– If input is \"1\" or \"stone\", return \"Stone\".– If input is \"2\" or \"paper\", return \"Paper\".– If input is \"3\" or \"scissors\", return \"Scissors\"."
        },
        {
          "type": "paragraph",
          "text": "Think of a polite error chime on an ATM when the wrong button is pressed."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-21",
      "sourcePageStart": 21,
      "sourcePageEnd": 21,
      "sourcePages": [
        21
      ],
      "title": "Goal: Inform the user of invalid input and re-prompt gracefully.",
      "kind": "information",
      "checkpointIndex": 6,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "STEP 5 — Handle Invalid Input☐  Otherwise, print \"Invalid input. Please enter 1, 2, or 3.\" and continue the loop."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Nikhil, choose your move:\n  [1] Stone\n  [2] Paper\n  [3] Scissors\nEnter choice (1-3): 4\nInvalid input. Please enter 1, 2, or 3.\n\nNikhil, choose your move:\n  [1] Stone\n  [2] Paper\n  [3] Scissors\nEnter choice (1-3): 1"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-22",
      "sourcePageStart": 22,
      "sourcePageEnd": 22,
      "sourcePages": [
        22
      ],
      "title": "Milestone Checkpoint: Human Move Input Pipeline Functional!",
      "kind": "information",
      "checkpointIndex": 6,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed defensive move validation:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Dual-Mode Input: Accepted both numeric options (1-3) and name aliases (stone, paper, scissors)."
        },
        {
          "type": "paragraph",
          "text": "☑  Defensive Reprompting: Malformed inputs trigger friendly error messages without throwing unhandled exceptions."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate a Player(\"Test\"), call choose_move(), enter abc, observe the error message, enter 2, and verify that the method returns \"Paper\"."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-23",
      "sourcePageStart": 23,
      "sourcePageEnd": 23,
      "sourcePages": [
        23
      ],
      "title": "OOP Specialization: The Automated Opponent",
      "kind": "task",
      "checkpointIndex": 7,
      "checkpointId": "stone-paper-scissors-task-8",
      "taskId": "stone-paper-scissors-task-8",
      "blocks": [
        {
          "type": "code",
          "code": "Now that we have a Player class that queries a human at the keyboard, how do we model the System opponent?"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Through object-oriented inheritance, SystemPlayer can inherit all fields (name, score, resetScore) from Player, but override the chooseMove() method. Instead of waiting for keyboard input, SystemPlayer picks a move randomly from MOVES."
        },
        {
          "type": "code",
          "code": "Task 8 — Create the SystemPlayer class skeleton"
        },
        {
          "type": "code",
          "code": "Create the SystemPlayer class extending Player:"
        },
        {
          "type": "paragraph",
          "text": "Think of creating an automated robotic player that follows the exact same tournament rules as a human."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Inherit all player state while fixing the participant name to \"System\"."
        },
        {
          "type": "code",
          "code": "STEP 1 — Subclass Player Entity☐  Define class SystemPlayer inheriting from Player. In its constructor, call the superclass constructor passing \"System\" as the name."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-24",
      "sourcePageStart": 24,
      "sourcePageEnd": 24,
      "sourcePages": [
        24
      ],
      "title": "Milestone Checkpoint: System Opponent Inherited!",
      "kind": "information",
      "checkpointIndex": 7,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established the computer opponent class:"
        },
        {
          "type": "code",
          "code": "☑  Subclass Created: Defined SystemPlayer extending Player."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Fixed Identity: Initialized name automatically to \"System\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate bot = SystemPlayer(). Verify that bot.name == \"System\" and bot.score == 0."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-25",
      "sourcePageStart": 25,
      "sourcePageEnd": 25,
      "sourcePages": [
        25
      ],
      "title": "Random Move Generation",
      "kind": "task",
      "checkpointIndex": 8,
      "checkpointId": "stone-paper-scissors-task-9",
      "taskId": "stone-paper-scissors-task-9",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "The computer opponent must select its move randomly from the valid moves pool (MOVES). By overriding choose_move(), the Game orchestrator can treat both human and computer opponents identically through polymorphism."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 9 — Implement system random move choice"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Override choose_move() (or chooseMove()) in SystemPlayer:"
        },
        {
          "type": "paragraph",
          "text": "Think of rolling a fair three-sided die to pick a hand gesture unpredictably."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Select a move uniformly at random from MOVES."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Generate Random Move Selection☐  Use your language's pseudo-random number generator to select an index from 0 to 2 (or pick directly from MOVES)."
        },
        {
          "type": "paragraph",
          "text": "Think of revealing the selected gesture to the referee."
        },
        {
          "type": "paragraph",
          "text": "Goal: Return the chosen move string."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Return Selected Move☐  Return the selected move string (\"Stone\", \"Paper\", or \"Scissors\")."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-26",
      "sourcePageStart": 26,
      "sourcePageEnd": 26,
      "sourcePages": [
        26
      ],
      "title": "Milestone Checkpoint: System Move Generation Operational!",
      "kind": "information",
      "checkpointIndex": 8,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed polymorphic computer move generation:"
        },
        {
          "type": "paragraph",
          "text": "☑  Polymorphic Override: Implemented automated move selection without keyboard prompts."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Uniform Distribution: Verified random selection from the canonical MOVES list."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate bot = SystemPlayer(), call bot.choose_move() 20 times in a loop, and verify that every returned move is in [\"Stone\", \"Paper\", \"Scissors\"]."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-27",
      "sourcePageStart": 27,
      "sourcePageEnd": 27,
      "sourcePages": [
        27
      ],
      "title": "Chapter 5: Building the Match Engine",
      "kind": "task",
      "checkpointIndex": 9,
      "checkpointId": "stone-paper-scissors-task-10",
      "taskId": "stone-paper-scissors-task-10",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "5.1 Game Manager & Round Execution"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "System Coordination: The Game Manager Skeleton"
        },
        {
          "type": "code",
          "code": "The Game class acts as the central coordinator. It holds both opponents (Player and SystemPlayer), manages the match score boundary (TARGET_SCORE = 3), and coordinates the flow of rounds."
        },
        {
          "type": "code",
          "code": "Task 10 — Create the Game class constructor"
        },
        {
          "type": "code",
          "code": "Create the Game class and its constructor:"
        },
        {
          "type": "paragraph",
          "text": "Think of setting up a match table with two seats: one for the human, one for the system."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Instantiate and store the human Player object with the provided name."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Instantiate Human Player☐  Accept player_name in the constructor and instantiate self.player = Player(player_name)."
        },
        {
          "type": "paragraph",
          "text": "Think of placing the automated chess clock and opponent across the table."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Instantiate and store the automated SystemPlayer opponent."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Instantiate System Opponent☐  Instantiate self.system = SystemPlayer()."
        },
        {
          "type": "paragraph",
          "text": "Think of posting the tournament rule sheet on the table."
        },
        {
          "type": "paragraph",
          "text": "Goal: Store the match victory boundary."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Initialize Target Score Threshold☐  Set self.target_score = TARGET_SCORE (3)."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-28",
      "sourcePageStart": 28,
      "sourcePageEnd": 28,
      "sourcePages": [
        28
      ],
      "title": "Milestone Checkpoint: Game Controller Assembled!",
      "kind": "information",
      "checkpointIndex": 9,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have constructed the game manager skeleton:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Entities Bound: Instantiated both human and automated participants inside Game."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Target Configured: Linked target_score to the global TARGET_SCORE constant."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate g = Game(\"Nikhil\"). Verify that g.player.name == \"Nikhil\", g.system.name == \"System\", and g.target_score == 3."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-29",
      "sourcePageStart": 29,
      "sourcePageEnd": 29,
      "sourcePages": [
        29
      ],
      "title": "Terminal Presentation: Scoreboard Card Layout",
      "kind": "task",
      "checkpointIndex": 10,
      "checkpointId": "stone-paper-scissors-task-11",
      "taskId": "stone-paper-scissors-task-11",
      "blocks": [
        {
          "type": "paragraph",
          "text": "In interactive terminal applications, visual polish matters. Rather than printing raw score numbers, we wrap the scores in a clean, centered ASCII card after every round."
        },
        {
          "type": "paragraph",
          "text": "======================================\n| SCORE: Nikhil [ 1 ] - System [ 0 ] |\n======================================"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 11 — Display the formatted scoreboard"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Add display_score() (or displayScore()) to Game:"
        },
        {
          "type": "paragraph",
          "text": "Think of drawing the upper steel beam of a stadium scoreboard."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print the top decorative border of the scoreboard box."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Print Scoreboard Top Border☐  Print a top border line of 38 equal signs: \"\\n======================================\"."
        },
        {
          "type": "paragraph",
          "text": "Think of formatting the team names and current scores neatly in the middle of the display."
        },
        {
          "type": "paragraph",
          "text": "Goal: Construct the centered score string enclosed by vertical borders."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Format Scoreboard Content☐  Construct the score text: \"SCORE: \" + player.name + \" [ \" + player.score + \" ] - System [ \" + system.score + \" ]\". Center this text within 34 characters and enclose with |."
        },
        {
          "type": "paragraph",
          "text": "Think of drawing the lower steel beam to close the scoreboard box."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print the bottom decorative border of the scoreboard box."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Print Scoreboard Bottom Border☐  Print a bottom border line of 38 equal signs: \"======================================\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "======================================\n| SCORE: Nikhil [ 1 ] - System [ 0 ] |\n======================================"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-30",
      "sourcePageStart": 30,
      "sourcePageEnd": 30,
      "sourcePages": [
        30
      ],
      "title": "Milestone Checkpoint: Scoreboard Visualization Operational!",
      "kind": "information",
      "checkpointIndex": 10,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed terminal scoreboard rendering:"
        },
        {
          "type": "paragraph",
          "text": "☑  Formatted ASCII Box: Printed centered 38-character card layout."
        },
        {
          "type": "paragraph",
          "text": "☑  Live State Reflection: Score values dynamically reflect player and system points."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate g = Game(\"Nikhil\"), set g.player.score = 2 and g.system.score = 1, and call g.display_score(). Verify that the centered card renders accurately."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-31",
      "sourcePageStart": 31,
      "sourcePageEnd": 31,
      "sourcePages": [
        31
      ],
      "title": "Turn-Based Operational Loop: Execution & Feedback",
      "kind": "task",
      "checkpointIndex": 11,
      "checkpointId": "stone-paper-scissors-task-12",
      "taskId": "stone-paper-scissors-task-12",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A game comes to life when user actions produce immediate, tangible feedback. In each round:"
        },
        {
          "type": "paragraph",
          "text": "1.  The round number is announced."
        },
        {
          "type": "paragraph",
          "text": "2.  Both opponents choose their moves."
        },
        {
          "type": "paragraph",
          "text": "3.  Both choices are revealed simultaneously."
        },
        {
          "type": "paragraph",
          "text": "4.  The referee evaluates the outcome."
        },
        {
          "type": "paragraph",
          "text": "5.  Scores are updated and the updated scoreboard is rendered."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 12 — Play a single round and reveal choices"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Add play_round(round_num) (or playRound(roundNum)) to Game:"
        },
        {
          "type": "paragraph",
          "text": "Think of a referee holding up a round sign in a boxing ring."
        },
        {
          "type": "paragraph",
          "text": "Goal: Announce the start of the current round."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Print Round Header☐  Print the round section header: \"\\n--- Round \" + round_num + \" ---\"."
        },
        {
          "type": "paragraph",
          "text": "Think of two players setting their cards face down on the table."
        },
        {
          "type": "paragraph",
          "text": "Goal: Retrieve moves from both the human player and system opponent."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Collect Opponent Moves☐  Call self.player.choose_move() to obtain player_move, and self.system.choose_move() to obtain system_move."
        },
        {
          "type": "paragraph",
          "text": "Think of turning both cards face up together so everyone can see the matchup."
        },
        {
          "type": "paragraph",
          "text": "Goal: Reveal both selections clearly to the console."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Reveal Choices☐  Print player.name + \" chose: \" + player_move and \"System chose: \" + system_move."
        },
        {
          "type": "paragraph",
          "text": "Think of handing both cards to an impartial judge with the rulebook."
        },
        {
          "type": "paragraph",
          "text": "Goal: Evaluate the round outcome using the decision tree engine."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Evaluate Outcome☐  Call determine_winner(player_move, system_move) to receive a RoundResult."
        },
        {
          "type": "paragraph",
          "text": "Think of the announcer calling the point and updating the tally."
        },
        {
          "type": "paragraph",
          "text": "Goal: Branch on the outcome, award points to the winner, and print the explanation."
        },
        {
          "type": "paragraph",
          "text": "STEP 5 — Update Scores and Announce Result☐  Update state based on result.winner:– If \"draw\", print \"Result: It's a draw! (\" + result.reason + \")\".– If \"player\", increment player.score by 1 and print \"Result: \" + result.reason + \"! \" + player.name + \" wins Round \" + round_num + \"!\".– If \"system\", increment system.score by 1 and print \"Result: \" + result.reason + \"! System wins Round \" + round_num + \"!\"."
        },
        {
          "type": "paragraph",
          "text": "Think of the stadium big screen refreshing to show the new match score."
        },
        {
          "type": "paragraph",
          "text": "Goal: Render the live scoreboard card."
        },
        {
          "type": "code",
          "code": "STEP 6 — Refresh Scoreboard☐"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-32",
      "sourcePageStart": 32,
      "sourcePageEnd": 32,
      "sourcePages": [
        32
      ],
      "title": "Call self.display_score().",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "--- Round 1 ---\n\nNikhil, choose your move:\n  [1] Stone\n  [2] Paper\n  [3] Scissors\nEnter choice (1-3): 1\n\nNikhil chose: Stone\nSystem chose: Scissors\nResult: Stone crushes Scissors! Nikhil wins Round 1!\n\n======================================\n| SCORE: Nikhil [ 1 ] - System [ 0 ] |\n======================================"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-33",
      "sourcePageStart": 33,
      "sourcePageEnd": 33,
      "sourcePages": [
        33
      ],
      "title": "Milestone Checkpoint: Single Round Engine Verified!",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed single round orchestration:"
        },
        {
          "type": "paragraph",
          "text": "☑  Full Round Lifecycle: Synchronized headers, move collection, simultaneous reveals, and score updates."
        },
        {
          "type": "paragraph",
          "text": "☑  Instant Visual Feedback: Live scoreboard rendered after every round."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate g = Game(\"Tester\"), call g.play_round(1), enter 1, and verify that move reveals, result statements, and scoreboard print cleanly."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-34",
      "sourcePageStart": 34,
      "sourcePageEnd": 34,
      "sourcePages": [
        34
      ],
      "title": "5.2 Match Control & Champion Resolution",
      "kind": "task",
      "checkpointIndex": 12,
      "checkpointId": "stone-paper-scissors-task-13",
      "taskId": "stone-paper-scissors-task-13",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Victory Announcement & Champion Presentation"
        },
        {
          "type": "paragraph",
          "text": "When a best-of-5 match concludes, the application must celebrate the winner with a clear, prominent champion announcement. Isolating champion presentation into its own method adheres to the Single Responsibility Principle."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 13 — Implement match champion announcement"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Add announce_champion() (or announceChampion()) to Game:"
        },
        {
          "type": "paragraph",
          "text": "Think of sounding the final tournament buzzer to signal the end of the match."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print the concluding match boundary banner."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Print Match Finished Banner☐  Print the match finished banner: \"\\n===== MATCH FINISHED =====\"."
        },
        {
          "type": "paragraph",
          "text": "Think of crowning the champion on the tournament podium."
        },
        {
          "type": "paragraph",
          "text": "Goal: Compare final scores and declare the winner."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Evaluate Final Scores and Crown Champion☐  If player.score > system.score, print \"MATCH CHAMPION: \" + player.name + \" wins the match!\". Otherwise, print \"MATCH CHAMPION: System wins the match! Better luck next time!\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "===== MATCH FINISHED =====\nMATCH CHAMPION: Nikhil wins the match!"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-35",
      "sourcePageStart": 35,
      "sourcePageEnd": 35,
      "sourcePages": [
        35
      ],
      "title": "Milestone Checkpoint: Champion Announcement Verified!",
      "kind": "information",
      "checkpointIndex": 12,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed match champion resolution:"
        },
        {
          "type": "paragraph",
          "text": "☑  Victory Resolution: Accurately identified match winner based on final scores."
        },
        {
          "type": "paragraph",
          "text": "☑  Podium Announcement: Rendered distinctive champion banners for both human and system victories."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate g = Game(\"Nikhil\"), set g.player.score = 3 and g.system.score = 1, call g.announce_champion(), and verify that \"MATCH CHAMPION: Nikhil wins the match!\" prints."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-36",
      "sourcePageStart": 36,
      "sourcePageEnd": 36,
      "sourcePages": [
        36
      ],
      "title": "Match Lifecycle: Target-Score Loop Architecture",
      "kind": "task",
      "checkpointIndex": 13,
      "checkpointId": "stone-paper-scissors-task-14",
      "taskId": "stone-paper-scissors-task-14",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Individual rounds are exciting, but a competitive best-of-5 series builds real tension. Because tied rounds award no points, a match can last 3 rounds in a clean sweep, or extend through many intense tiebreakers until one participant finally earns 3 points."
        },
        {
          "type": "paragraph",
          "text": "A control loop coordinates this lifecycle by maintaining round numbers, checking score boundaries after every round, and declaring the overall match champion once someone reaches the target."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 14 — Write the playMatch() loop"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Add play_match() (or playMatch()) to Game:"
        },
        {
          "type": "paragraph",
          "text": "Think of clearing the scoreboard and preparing the field for a fresh match."
        },
        {
          "type": "paragraph",
          "text": "Goal: Reset both players' scores to zero and initialize the round counter."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Reset Opponent Scores☐  Call reset_score() on both self.player and self.system, and set round_num = 1."
        },
        {
          "type": "paragraph",
          "text": "Think of the tournament master announcing the rules before opening play."
        },
        {
          "type": "paragraph",
          "text": "Goal: Announce the start of the match and victory condition."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Print Match Start Banner☐  Print the match start banner: \"\\n===== NEW MATCH STARTED =====\\nFirst to reach 3 points wins the match!\"."
        },
        {
          "type": "paragraph",
          "text": "Think of playing rounds continuously until one contestant reaches the target score."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Run a loop calling play_round while both scores are below the target."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Run Turn-Based Round Loop☐  While player.score < target_score and system.score < target_score:– Call self.play_round(round_num).– Increment round_num by 1."
        },
        {
          "type": "paragraph",
          "text": "Think of crowning the winner once the final point is scored."
        },
        {
          "type": "paragraph",
          "text": "Goal: Invoke the champion announcement once the loop terminates."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Announce Match Champion☐  Call self.announce_champion()."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "===== NEW MATCH STARTED =====\nFirst to reach 3 points wins the match!\n\n--- Round 1 ---\n\nNikhil, choose your move:\n  [1] Stone\n  [2] Paper\n  [3] Scissors\nEnter choice (1-3): 1\n\nNikhil chose: Stone\nSystem chose: Scissors\nResult: Stone crushes Scissors! Nikhil wins Round 1!\n\n======================================"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-37",
      "sourcePageStart": 37,
      "sourcePageEnd": 37,
      "sourcePages": [
        37
      ],
      "title": "Source page 37",
      "kind": "information",
      "checkpointIndex": 13,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "| SCORE: Nikhil [ 1 ] - System [ 0 ] |\n======================================\n\n--- Round 2 ---\n\nNikhil, choose your move:\n  [1] Stone\n  [2] Paper\n  [3] Scissors\nEnter choice (1-3): 2\n\nNikhil chose: Paper\nSystem chose: Stone\nResult: Paper covers Stone! Nikhil wins Round 2!\n\n======================================\n| SCORE: Nikhil [ 2 ] - System [ 0 ] |\n======================================\n\n--- Round 3 ---\n\nNikhil, choose your move:\n  [1] Stone\n  [2] Paper\n  [3] Scissors\nEnter choice (1-3): 1\n\nNikhil chose: Stone\nSystem chose: Scissors\nResult: Stone crushes Scissors! Nikhil wins Round 3!\n\n======================================\n| SCORE: Nikhil [ 3 ] - System [ 0 ] |\n======================================\n\n===== MATCH FINISHED =====\nMATCH CHAMPION: Nikhil wins the match!"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-38",
      "sourcePageStart": 38,
      "sourcePageEnd": 38,
      "sourcePages": [
        38
      ],
      "title": "Milestone Checkpoint: Best-of-5 Match Loop Complete!",
      "kind": "information",
      "checkpointIndex": 13,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have constructed the competitive match engine:"
        },
        {
          "type": "paragraph",
          "text": "☑  First-to-3 Points Engine: Automated round loop running until a player reaches the victory threshold."
        },
        {
          "type": "paragraph",
          "text": "☑  Tiebreaker Resilience: Seamlessly handles draws by continuing until a champion emerges."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate g = Game(\"Alex\"), call g.play_match(), play until either side reaches 3 points, and verify that the match finishes and crowns the champion."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-39",
      "sourcePageStart": 39,
      "sourcePageEnd": 39,
      "sourcePages": [
        39
      ],
      "title": "Chapter 6: Adding Replayability & Full Application Execution",
      "kind": "task",
      "checkpointIndex": 14,
      "checkpointId": "stone-paper-scissors-task-15",
      "taskId": "stone-paper-scissors-task-15",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "6.1 Session Management & Application Assembly"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Continuing the Excitement: Rematch Confirmation"
        },
        {
          "type": "paragraph",
          "text": "After an intense match, players often want to jump straight into a rematch without having to restart the terminal program."
        },
        {
          "type": "paragraph",
          "text": "We will add an interactive replay prompt that validates yes/no responses, and wrap our game execution in a session loop."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 15 — Implement askReplay()"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Add ask_replay() (or askReplay()) to Game:"
        },
        {
          "type": "paragraph",
          "text": "Think of a referee asking both players if they want a rematch before packing up the table."
        },
        {
          "type": "paragraph",
          "text": "Goal: Run an indefinite loop prompting for rematch confirmation."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Interactive Replay Prompt Loop☐  Run an indefinite loop (while True / while (true))."
        },
        {
          "type": "paragraph",
          "text": "Think of reading the player's verbal answer clearly."
        },
        {
          "type": "paragraph",
          "text": "Goal: Read and sanitize the confirmation response."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Read and Normalize Confirmation Input☐  Prompt with \"\\nPlay again? (y/n): \", strip whitespace, and convert to lowercase."
        },
        {
          "type": "paragraph",
          "text": "Think of processing the player's decision."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Goal: Return True for affirmative responses, False for negative, or re-prompt."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Evaluate Replay Choice☐  If input is \"y\", return True. If input is \"n\", return False. Otherwise, print \"Please type y or n.\" and repeat the loop."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Play again? (y/n): maybe\nPlease type y or n.\n\nPlay again? (y/n): y"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-40",
      "sourcePageStart": 40,
      "sourcePageEnd": 40,
      "sourcePages": [
        40
      ],
      "title": "Milestone Checkpoint: Rematch Prompt Functional!",
      "kind": "information",
      "checkpointIndex": 14,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed defensive rematch confirmation:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Defensive Prompt: Validates y and n inputs while rejecting invalid responses."
        },
        {
          "type": "paragraph",
          "text": "☑  Session Control: Returns clean boolean flags to guide outer session flow."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call Game.ask_replay(), enter invalid, confirm error message, enter n, and verify that the method returns False."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-41",
      "sourcePageStart": 41,
      "sourcePageEnd": 41,
      "sourcePages": [
        41
      ],
      "title": "Continuous Operations: The Multi-Match Engine",
      "kind": "task",
      "checkpointIndex": 15,
      "checkpointId": "stone-paper-scissors-task-16",
      "taskId": "stone-paper-scissors-task-16",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Now we connect the match loop and rematch confirmation together. The application will continue running fresh matches until the player decides to conclude the session."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 16 — Implement playMany() for continuous play"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Add play_many() (or playMany()) to Game:"
        },
        {
          "type": "paragraph",
          "text": "Think of an open arcade cabinet that remains available for consecutive matches."
        },
        {
          "type": "paragraph",
          "text": "Goal: Coordinate the top-level session loop."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Continuous Match Session Loop☐  Run an indefinite loop (while True / while (true))."
        },
        {
          "type": "paragraph",
          "text": "Think of playing one full match from start to finish."
        },
        {
          "type": "paragraph",
          "text": "Goal: Execute a complete best-of-5 match."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Execute Match Lifecycle☐  Call self.play_match()."
        },
        {
          "type": "paragraph",
          "text": "Think of checking if the player wants another coin inserted."
        },
        {
          "type": "paragraph",
          "text": "Goal: Prompt for rematch confirmation and break if declined."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Prompt for Rematch Confirmation☐  Call self.ask_replay(). If it returns False, proceed to exit."
        },
        {
          "type": "paragraph",
          "text": "Think of thanking the player as they leave the arcade."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print a polite closing message upon session termination."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Display Session Farewell on Exit☐  Print \"\\nThanks for playing Stone Paper Scissors!\" and break the loop."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Play again? (y/n): n\n\nThanks for playing Stone Paper Scissors!"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-42",
      "sourcePageStart": 42,
      "sourcePageEnd": 42,
      "sourcePages": [
        42
      ],
      "title": "Milestone Checkpoint: Multi-Match Session Engine Complete!",
      "kind": "information",
      "checkpointIndex": 15,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed multi-match session management:"
        },
        {
          "type": "paragraph",
          "text": "☑  Continuous Play: Enabled back-to-back matches with automatic score resetting."
        },
        {
          "type": "paragraph",
          "text": "☑  Graceful Exit: Clean departure banner displayed when the player finishes."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Instantiate g = Game(\"Nikhil\"), call g.play_many(), play 1 match, answer n at the prompt, and verify that \"Thanks for playing Stone Paper Scissors!\" prints."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-43",
      "sourcePageStart": 43,
      "sourcePageEnd": 43,
      "sourcePages": [
        43
      ],
      "title": "Putting It All Together: Application Assembly",
      "kind": "task",
      "checkpointIndex": 16,
      "checkpointId": "stone-paper-scissors-task-17",
      "taskId": "stone-paper-scissors-task-17",
      "blocks": [
        {
          "type": "paragraph",
          "text": "With all classes and helper methods built, we now create the entry point that ties the entire application together into a runnable command-line program."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 17 — Assemble the main() entry point"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement the main() entry point function:"
        },
        {
          "type": "paragraph",
          "text": "Think of powering on the system and welcoming the player."
        },
        {
          "type": "paragraph",
          "text": "Goal: Display the opening banner."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Initialize System Environment and Welcome Banner☐  Call print_welcome() (or printWelcome())."
        },
        {
          "type": "paragraph",
          "text": "Think of asking the player for their gamer tag at the registration desk."
        },
        {
          "type": "paragraph",
          "text": "Goal: Prompt the user to enter their name."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Capture Player Identity☐  Prompt the user with \"Enter your name: \" and capture their input into player_name."
        },
        {
          "type": "paragraph",
          "text": "Think of creating the custom game arena for this player."
        },
        {
          "type": "paragraph",
          "text": "Goal: Instantiate the Game controller."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Instantiate Game Manager☐  Instantiate game = Game(player_name)."
        },
        {
          "type": "paragraph",
          "text": "Think of starting the arcade machine."
        },
        {
          "type": "paragraph",
          "text": "Goal: Launch the multi-match session engine."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Launch Continuous Match Session☐  Call game.play_many() (or game.playMany())."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Welcome to Stone Paper Scissors!\nEnter your name: Nikhil\n\n===== NEW MATCH STARTED =====\nFirst to reach 3 points wins the match!"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-44",
      "sourcePageStart": 44,
      "sourcePageEnd": 44,
      "sourcePages": [
        44
      ],
      "title": "Milestone Checkpoint: Full Application Experience Achieved!",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Congratulations! You have constructed a complete, enterprise-grade, object-oriented CLI application:"
        },
        {
          "type": "paragraph",
          "text": "☑  Full Session Lifecycle: Clean startup banner, name capture, multi-round match execution, and rematch management."
        },
        {
          "type": "paragraph",
          "text": "☑  Tri-Language Parity: 100% equivalent implementations in Python, C++17, and Java 21."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Run the complete application from terminal: python StonePaperScissors.py (or execute the compiled C++ / Java binary). Play through a full match and verify all prompts and scoreboards work smoothly."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-45",
      "sourcePageStart": 45,
      "sourcePageEnd": 45,
      "sourcePages": [
        45
      ],
      "title": "Chapter 7: Reflect & Expand",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "7.1 What You Have Built"
        },
        {
          "type": "paragraph",
          "text": "You have constructed an interactive, object-oriented Stone Paper Scissors game featuring:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Deterministic rule-based evaluation using clean, beginner-friendly if / else if logic with descriptive winning justifications",
            "Robust defensive input validation accepting both numeric codes and string aliases without crashing",
            "Unpredictable computer move generation using standard language utilities",
            "Best-of-5 match loop with a live formatted ASCII scoreboard card",
            "Seamless session replayability"
          ]
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Skills Practiced Matrix"
        },
        {
          "type": "table",
          "columns": [
            "Skill",
            "How You Used It"
          ],
          "rows": [
            [
              "Variables & Constants",
              "Declared MOVES pool and TARGET_SCORE boundaries"
            ],
            [
              "Encapsulation & Data Modeling",
              "Encapsulated outcome fields into the RoundResult model"
            ],
            [
              "Conditionals (if/else)",
              "Evaluated move comparisons and determined round winners with real-world reasons"
            ],
            [
              "Randomization",
              "Generated computer moves across the 3 choices using standard PRNG utilities"
            ],
            [
              "Defensive Loops (while)",
              "Drove the round loop, input validation, and rematch session loops"
            ],
            [
              "OOP & Inheritance",
              "Modeled Player and specialized SystemPlayer with polymorphic move selection"
            ],
            [
              "Architecture & Separation",
              "Separated entity behavior, rule evaluation, scoreboard layout, and match coordination"
            ]
          ]
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-46",
      "sourcePageStart": 46,
      "sourcePageEnd": 46,
      "sourcePages": [
        46
      ],
      "title": "7.2 Extension Ideas",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "1.  Stone-Paper-Scissors-Lizard-Spock: Expand from 3 to 5 moves using the famous extended rules (Scissors decapitates Lizard, Lizard poisons Spock, Spock smashes Scissors, Spock vaporizes Stone, etc.)."
        },
        {
          "type": "paragraph",
          "text": "2.  AI Move Predictor: Build a smarter System opponent that tracks player move frequency over time and counter-picks their most commonly played moves."
        },
        {
          "type": "paragraph",
          "text": "3.  Custom Match Length: Allow the user to configure the match length at startup (e.g., Best of 1, Best of 3, Best of 7)."
        },
        {
          "type": "paragraph",
          "text": "4.  Match History Log: Maintain a collection of all played rounds and print a summary table at the end of the match showing round-by-round picks."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-47",
      "sourcePageStart": 47,
      "sourcePageEnd": 47,
      "sourcePages": [
        47
      ],
      "title": "7.3 Share What You Built! Time to Showcase Your Project!",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Why Showcasing Matters"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Demonstrating Mastery: Explaining how inheritance and input validation work in your project proves your understanding of core software engineering principles.",
            "Portfolio Building: Clean command-line projects with robust validation and multi-language support stand out in technical interviews and college admissions.",
            "Peer Collaboration: Getting feedback on your code and gameplay pacing helps you discover new edge cases and optimizations."
          ]
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Professional Presentation Tips"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "1.  GitHub Repository: Push your code with a clean README.md containing the ASCII scoreboard diagram, game rules, and execution commands."
        },
        {
          "type": "paragraph",
          "text": "2.  Demonstration GIF / Video: Record a 30-second terminal session showcasing an interactive match and rematch prompt."
        },
        {
          "type": "paragraph",
          "text": "3.  LinkedIn / Portfolio Post: Share a screenshot of the scoreboard and highlight your implementation of object-oriented polymorphism and defensive input validation."
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-48",
      "sourcePageStart": 48,
      "sourcePageEnd": 48,
      "sourcePages": [
        48
      ],
      "title": "Appendix: Full Pseudocode Reference",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "// Task 1 - Create the entry file and print welcome message\n// Step 1: Entry File Setup\n// (Import standard system packages and random number utilities)\n\nFUNCTION printWelcome():\n    // Step 2: Welcome Banner Output\n    PRINT \"Welcome to Stone Paper Scissors!\"\n\n\n// Task 2 - Define valid moves and target score\n// Step 1: Declare Move Collection\nCONSTANTS:\n    MOVES = [\"Stone\", \"Paper\", \"Scissors\"]\n\n// Step 2: Declare Target Score Threshold\n    TARGET_SCORE = 3\n\n\n// Task 3 - Create the RoundResult model\nCLASS RoundResult:\n    winner\n    reason\n\n    CONSTRUCTOR(winner, reason):\n        // Step 1: Initialize Winner Identifier\n        SET this.winner = winner\n\n        // Step 2: Initialize Outcome Reason\n        SET this.reason = reason\n\n\n// Task 4 - Implement determineWinner(playerMove, systemMove)\nFUNCTION determineWinner(playerMove, systemMove):\n    // Step 1: Check Draw Condition\n    IF playerMove == systemMove:\n        RETURN new RoundResult(\"draw\", \"Both chose \" + playerMove)\n\n    // Step 2: Check Player Victory Conditions\n    ELSE IF playerMove == \"Stone\" AND systemMove == \"Scissors\":\n        RETURN new RoundResult(\"player\", \"Stone crushes Scissors\")\n    ELSE IF playerMove == \"Scissors\" AND systemMove == \"Paper\":\n        RETURN new RoundResult(\"player\", \"Scissors cuts Paper\")\n    ELSE IF playerMove == \"Paper\" AND systemMove == \"Stone\":\n        RETURN new RoundResult(\"player\", \"Paper covers Stone\")\n\n    // Step 3: Check System Victory Conditions\n    ELSE IF systemMove == \"Stone\" AND playerMove == \"Scissors\":\n        RETURN new RoundResult(\"system\", \"Stone crushes Scissors\")\n    ELSE IF systemMove == \"Scissors\" AND playerMove == \"Paper\":\n        RETURN new RoundResult(\"system\", \"Scissors cuts Paper\")\n    ELSE:\n        RETURN new RoundResult(\"system\", \"Paper covers Stone\")\n\n\n// Task 5 - Create the Player class constructor\nCLASS Player:\n    name\n    score = 0\n\n    CONSTRUCTOR(rawName):"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-49",
      "sourcePageStart": 49,
      "sourcePageEnd": 49,
      "sourcePages": [
        49
      ],
      "title": "Source page 49",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "// Step 1: Sanitize Player Name\n        trim rawName; if blank default to \"Player\"\n\n        // Step 2: Initialize Starting Score\n        SET score = 0\n\n    // Task 6 - Implement score reset on Player\n    FUNCTION resetScore():\n        // Step 1: Zero Out Score\n        SET score = 0\n\n    // Task 7 - Implement validated human move input\n    FUNCTION chooseMove():\n        // Step 1: Interactive Prompt Loop\n        LOOP:\n            // Step 2: Display Choice Menu\n            PROMPT name + \", choose your move: [1] Stone, [2] Paper, [3] Scissors\"\n\n            // Step 3: Read and Normalize Input\n            choice = READ_INPUT() trimmed and lowercased\n\n            // Step 4: Validate and Map Choices\n            IF choice in [\"1\", \"stone\"]: RETURN \"Stone\"\n            IF choice in [\"2\", \"paper\"]: RETURN \"Paper\"\n            IF choice in [\"3\", \"scissors\"]: RETURN \"Scissors\"\n\n            // Step 5: Handle Invalid Input\n            PRINT \"Invalid input. Please enter 1, 2, or 3.\"\n\n\n// Task 8 - Create the SystemPlayer class skeleton\nCLASS SystemPlayer EXTENDS Player:\n    CONSTRUCTOR():\n        // Step 1: Subclass Player Entity\n        SUPER(\"System\")\n\n    // Task 9 - Implement system random move choice\n    FUNCTION chooseMove():\n        // Step 1: Generate Random Move Selection\n        selectedMove = random pick from MOVES\n\n        // Step 2: Return Selected Move\n        RETURN selectedMove\n\n\n// Task 10 - Create the Game class constructor\nCLASS Game:\n    player\n    system\n    targetScore\n\n    CONSTRUCTOR(playerName):\n        // Step 1: Instantiate Human Player\n        SET player = new Player(playerName)\n\n        // Step 2: Instantiate System Opponent\n        SET system = new SystemPlayer()\n\n        // Step 3: Initialize Target Score Threshold\n        SET targetScore = TARGET_SCORE\n\n    // Task 11 - Display the formatted scoreboard"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-50",
      "sourcePageStart": 50,
      "sourcePageEnd": 50,
      "sourcePages": [
        50
      ],
      "title": "Source page 50",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "FUNCTION displayScore():\n        // Step 1: Print Scoreboard Top Border\n        PRINT \"======================================\"\n\n        // Step 2: Format Scoreboard Content\n        scoreText = \"SCORE: \" + player.name + \" [ \" + player.score + \" ] - System [ \" + system.score + \" ]\"\n        PRINT scoreText centered within 34 characters enclosed by \"|\"\n\n        // Step 3: Print Scoreboard Bottom Border\n        PRINT \"======================================\"\n\n    // Task 12 - Play a single round and reveal choices\n    FUNCTION playRound(roundNum):\n        // Step 1: Print Round Header\n        PRINT \"--- Round \" + roundNum + \" ---\"\n\n        // Step 2: Collect Opponent Moves\n        playerMove = player.chooseMove()\n        systemMove = system.chooseMove()\n\n        // Step 3: Reveal Choices\n        PRINT player.name + \" chose: \" + playerMove\n        PRINT \"System chose: \" + systemMove\n\n        // Step 4: Evaluate Outcome\n        result = determineWinner(playerMove, systemMove)\n\n        // Step 5: Update Scores and Announce Result\n        IF result.winner == \"draw\":\n            PRINT \"Result: It's a draw! (\" + result.reason + \")\"\n        ELSE IF result.winner == \"player\":\n            player.score = player.score + 1\n            PRINT \"Result: \" + result.reason + \"! \" + player.name + \" wins Round \" + roundNum + \"!\"\n        ELSE:\n            system.score = system.score + 1\n            PRINT \"Result: \" + result.reason + \"! System wins Round \" + roundNum + \"!\"\n\n        // Step 6: Refresh Scoreboard\n        displayScore()\n\n    // Task 13 - Implement match champion announcement\n    FUNCTION announceChampion():\n        // Step 1: Print Match Finished Banner\n        PRINT \"===== MATCH FINISHED =====\"\n\n        // Step 2: Evaluate Final Scores and Crown Champion\n        IF player.score > system.score:\n            PRINT \"MATCH CHAMPION: \" + player.name + \" wins the match!\"\n        ELSE:\n            PRINT \"MATCH CHAMPION: System wins the match! Better luck next time!\"\n\n    // Task 14 - Write the playMatch() loop\n    FUNCTION playMatch():\n        // Step 1: Reset Opponent Scores\n        player.resetScore()\n        system.resetScore()\n        roundNum = 1\n\n        // Step 2: Print Match Start Banner\n        PRINT \"===== NEW MATCH STARTED =====\\nFirst to reach \" + targetScore + \" points wins the"
        }
      ]
    },
    {
      "id": "stone-paper-scissors-source-page-51",
      "sourcePageStart": 51,
      "sourcePageEnd": 51,
      "sourcePages": [
        51
      ],
      "title": "Source page 51",
      "kind": "information",
      "checkpointIndex": 16,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "match!\"\n\n        // Step 3: Run Turn-Based Round Loop\n        WHILE player.score < targetScore AND system.score < targetScore:\n            playRound(roundNum)\n            roundNum = roundNum + 1\n\n        // Step 4: Announce Match Champion\n        announceChampion()\n\n    // Task 15 - Implement askReplay()\n    STATIC FUNCTION askReplay():\n        // Step 1: Interactive Replay Prompt Loop\n        LOOP:\n            // Step 2: Read and Normalize Confirmation Input\n            PROMPT \"Play again? (y/n): \"\n            answer = READ_INPUT() trimmed and lowercased\n\n            // Step 3: Evaluate Replay Choice\n            IF answer == \"y\": RETURN true\n            IF answer == \"n\": RETURN false\n            PRINT \"Please type y or n.\"\n\n    // Task 16 - Implement playMany() for continuous play\n    FUNCTION playMany():\n        // Step 1: Continuous Match Session Loop\n        LOOP:\n            // Step 2: Execute Match Lifecycle\n            playMatch()\n\n            // Step 3: Prompt for Rematch Confirmation\n            IF NOT askReplay():\n                // Step 4: Display Session Farewell on Exit\n                PRINT \"Thanks for playing Stone Paper Scissors!\"\n                BREAK\n\n\n// Task 17 - Assemble the main() entry point\nFUNCTION main():\n    // Step 1: Initialize System Environment and Welcome Banner\n    printWelcome()\n\n    // Step 2: Capture Player Identity\n    playerName = READ_INPUT(\"Enter your name: \")\n\n    // Step 3: Instantiate Game Manager\n    game = new Game(playerName)\n\n    // Step 4: Launch Continuous Match Session\n    game.playMany()"
        }
      ]
    }
  ],
  "currency-converter": [
    {
      "id": "currency-converter-source-page-01",
      "sourcePageStart": 1,
      "sourcePageEnd": 1,
      "sourcePages": [
        1
      ],
      "title": "Multi-Unit & Currency Converter CLI",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "Chapter 1: Introduction"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "1.1 Getting Started"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Meet Your Project"
        },
        {
          "type": "paragraph",
          "text": "You are about to build Multi-Unit & Currency Converter CLI — a comprehensive, practical terminal application that converts real-world values across four major measurement domains: global currencies, length/distance, mass/weight, and temperature scales."
        },
        {
          "type": "paragraph",
          "text": "Rather than building a brittle calculator with hardcoded pairwise formulas, this project teaches the architectural design used in professional measurement and finance software: the Base Unit Pivot Pattern. By converting every input into a standardized base reference unit (such as USD, Meters, Kilograms, or Celsius) before projecting into the desired target unit, your codebase remains compact, clean, and effortlessly extensible."
        },
        {
          "type": "paragraph",
          "text": "Once completed, you will have a versatile command-line utility capable of handling real-world exchange rates, micro- and macro-distances, imperial and metric masses, offset-based temperature math with physical boundary checks, and a resilient menu-driven interface that gracefully handles invalid user inputs."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-02",
      "sourcePageStart": 2,
      "sourcePageEnd": 2,
      "sourcePages": [
        2
      ],
      "title": "What You Will Learn",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You will construct this application from start to finish. By the end, you will have a production-grade utility you can run, explain, and expand."
        },
        {
          "type": "paragraph",
          "text": "You will learn how to:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Design and utilize lookup tables using Hash Maps and Dictionaries (dict in Python, map in C++, HashMap in Java)",
            "Implement the Base Unit Pivot Pattern to eliminate combinatorial code explosion ($N \\times (N - 1)$ formulas)",
            "Formulate linear ratio calculations for currencies, distances, and masses",
            "Implement non-linear algebraic conversions with additive offsets for temperature scales (Celsius, Fahrenheit, Kelvin)",
            "Enforce physical constraints and input validation, including preventing negative mass/distance and values below Absolute Zero",
            "Format high-precision numeric output (2 decimals for financial amounts and 4 decimals for scientific ratios)",
            "Build an intuitive, turn-based CLI menu navigation loop with case-insensitive unit code parsing"
          ]
        }
      ]
    },
    {
      "id": "currency-converter-source-page-03",
      "sourcePageStart": 3,
      "sourcePageEnd": 3,
      "sourcePages": [
        3
      ],
      "title": "What You Need",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Before you begin, make sure you are comfortable with:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Printing formatted output and reading keyboard input",
            "Variables, conditionals (if / else), and loops (while, for)",
            "Working with key-value data structures (maps, dictionaries, or associative arrays)",
            "Floating-point arithmetic and numeric formatting",
            "Basic functions and subroutines",
            "String case manipulation and basic exception handling (try / except / catch)"
          ]
        },
        {
          "type": "paragraph",
          "text": "This project is tailored specifically for beginners, guiding you step by step through every function and concept with clear, readable code."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-04",
      "sourcePageStart": 4,
      "sourcePageEnd": 4,
      "sourcePages": [
        4
      ],
      "title": "1.2 Starting with Small Steps",
      "kind": "task",
      "checkpointIndex": 0,
      "checkpointId": "currency-converter-task-1",
      "taskId": "currency-converter-task-1",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "First Steps into Code: The Welcome Banner"
        },
        {
          "type": "paragraph",
          "text": "Every software project begins with a single step. Before constructing mathematical conversion tables or input validation loops, we first establish our project entry file and verify that our execution environment is properly wired."
        },
        {
          "type": "paragraph",
          "text": "To do this, we create our entry point and print a clean welcome banner to confirm that the application environment is operational."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 1 — Create the entry file and print welcome header"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Create your project entry file and implement print_welcome() (or printWelcome()):"
        },
        {
          "type": "paragraph",
          "text": "Think of turning on the power to a digital laboratory workbench."
        },
        {
          "type": "paragraph",
          "text": "Goal: Establish the execution root and prepare the script environment."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Entry File Setup☐  Create your project file (Converter.py, Converter.cpp, or Converter.java) and import required system modules."
        },
        {
          "type": "paragraph",
          "text": "Think of displaying a digital greeting sign at a currency bureau."
        },
        {
          "type": "paragraph",
          "text": "Goal: Provide immediate visual confirmation that the application is running."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Welcome Banner Output☐  Print the welcome message string: \"Welcome to Multi-Unit & Currency Converter CLI!\"."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Welcome to Multi-Unit & Currency Converter CLI!"
        }
      ]
    },
    {
      "id": "currency-converter-source-page-05",
      "sourcePageStart": 5,
      "sourcePageEnd": 5,
      "sourcePages": [
        5
      ],
      "title": "Milestone Checkpoint: Environment Operational & Greeting Verified!",
      "kind": "information",
      "checkpointIndex": 0,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established the project entry point:"
        },
        {
          "type": "paragraph",
          "text": "☑  Entry File Created: Initialized the project source file and confirmed compiler execution."
        },
        {
          "type": "paragraph",
          "text": "☑  Greeting Banner Verified: Successfully printed the welcome banner to the terminal."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call print_welcome() (or printWelcome()) directly from your main execution block. Verify that \"Welcome to Multi-Unit & Currency Converter CLI!\" prints cleanly to the console."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-06",
      "sourcePageStart": 6,
      "sourcePageEnd": 6,
      "sourcePages": [
        6
      ],
      "title": "The Currency Exchange Rate Table (Base: USD)",
      "kind": "task",
      "checkpointIndex": 1,
      "checkpointId": "currency-converter-task-2",
      "taskId": "currency-converter-task-2",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Foreign currency exchange operates relative to global benchmark currencies. In international finance, the United States Dollar (USD) frequently serves as the reference currency."
        },
        {
          "type": "paragraph",
          "text": "Instead of hardcoding individual exchange rates across multiple conversion functions, we store them in a centralized dictionary or hash map where 1.0 USD is the pivot base."
        },
        {
          "type": "table",
          "columns": [
            "Currency Code",
            "Full Name",
            "Value Relative to 1.0 USD"
          ],
          "rows": [
            [
              "USD",
              "United States Dollar (Base)",
              "1.0"
            ],
            [
              "EUR",
              "Euro",
              "0.92"
            ],
            [
              "GBP",
              "British Pound Sterling",
              "0.79"
            ],
            [
              "INR",
              "Indian Rupee",
              "83.0"
            ],
            [
              "JPY",
              "Japanese Yen",
              "155.0"
            ],
            [
              "CAD",
              "Canadian Dollar",
              "1.36"
            ]
          ]
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 2 — Define Currency rates table (Base: USD)"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Declare the CURRENCY_RATES lookup table:"
        },
        {
          "type": "paragraph",
          "text": "Think of posting the official morning currency exchange board in a bank lobby."
        },
        {
          "type": "paragraph",
          "text": "Goal: Map each currency code to its fixed exchange rate relative to 1.0 USD."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Declare Currency Rates Lookup Table☐  Declare dictionary or map CURRENCY_RATES mapping: \"USD\": 1.0, \"EUR\": 0.92, \"GBP\": 0.79, \"INR\": 83.0, \"JPY\": 155.0, \"CAD\": 1.36."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-07",
      "sourcePageStart": 7,
      "sourcePageEnd": 7,
      "sourcePages": [
        7
      ],
      "title": "Milestone Checkpoint: Currency Rates Lookup Table Configured!",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established the foreign exchange rate table:"
        },
        {
          "type": "paragraph",
          "text": "☑  6 Currencies Registered: Configured USD, EUR, GBP, INR, JPY, and CAD."
        },
        {
          "type": "paragraph",
          "text": "☑  Pivot Base Established: Verified USD holds the reference value of 1.0."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Lookup CURRENCY_RATES[\"INR\"]. Verify that it evaluates to 83.0."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-08",
      "sourcePageStart": 8,
      "sourcePageEnd": 8,
      "sourcePages": [
        8
      ],
      "title": "Chapter 2: Rules & Design Plan",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "2.1 Understanding the Project"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Project Overview & Categories"
        },
        {
          "type": "paragraph",
          "text": "The Multi-Unit and Currency Converter is an interactive command-line utility designed to perform fast, accurate conversions across four fundamental categories:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Currency: 6 world currencies (USD, EUR, GBP, INR, JPY, CAD)",
            "Length: 5 distance units (meters, kilometers, miles, feet, inches)",
            "Weight: 4 mass units (kilograms, grams, pounds, ounces)",
            "Temperature: 3 thermal scales (Celsius, Fahrenheit, Kelvin)"
          ]
        },
        {
          "type": "heading",
          "level": 4,
          "text": "The Base Unit Pivot Architecture (O(N) vs O(N^2))"
        },
        {
          "type": "paragraph",
          "text": "A naive approach to unit conversion is writing dedicated pairwise formulas for every possible source and target pair. For 6 currencies, pairwise conversions require:"
        },
        {
          "type": "paragraph",
          "text": "$$\\text{Pairs} = N \\times (N - 1) = 6 \\times 5 = 30 \\text{ separate formulas}$$"
        },
        {
          "type": "paragraph",
          "text": "Adding 4 more units would escalate this requirement to 90 separate formulas. This combinatorial explosion creates unmaintainable, bug-prone code."
        },
        {
          "type": "paragraph",
          "text": "The industry-standard solution is the Base Unit Pivot Pattern. We designate a single reference base unit for each measurement category and express all units within that category relative to that single standard:"
        },
        {
          "type": "paragraph",
          "text": "/"
        },
        {
          "type": "paragraph",
          "text": "With this pattern, supporting $N$ units requires only defining $N$ ratios in a lookup table. Adding a new unit requires only a single new entry!"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Summary of Conversion Categories & Operations"
        },
        {
          "type": "table",
          "columns": [
            "Category",
            "Base Unit",
            "Supported Units",
            "Mathematical Operation"
          ],
          "rows": [
            [
              "Currency",
              "USD",
              "USD, EUR, GBP, INR, JPY, CAD",
              "$\\text{Target} = (\\text{Amount} / \\text{Source Rate}) \\times \\text{Target Rate}$"
            ],
            [
              "Length",
              "Meter (m)",
              "m, km, mi, ft, in",
              "$\\text{Target} = (\\text{Amount} \\times \\text{Source Ratio}) / \\text{Target Ratio}$"
            ],
            [
              "Weight",
              "Kilogram (kg)",
              "kg, g, lbs, oz",
              "$\\text{Target} = (\\text{Amount} \\times \\text{Source Ratio}) / \\text{Target Ratio}$"
            ],
            [
              "Temperature",
              "Celsius (C)",
              "C, F, K",
              "Non-linear algebraic offsets ($\\pm 32.0$, $\\pm 273.15$)"
            ]
          ]
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Physical Boundaries & Absolute Zero"
        },
        {
          "type": "paragraph",
          "text": "Lengths, weights, and currency amounts cannot be negative in physical reality. Temperature, however, can legitimately take negative values. Physics establishes an absolute lower bound: Absolute Zero (0 K, -273.15 °C, -459.67 °F). Our application enforces strict physical boundary checks to reject temperatures below absolute zero and negative quantities for distance, weight, and currency."
        },
        {
          "type": "image",
          "src": "/assets/projects/guides/currency-converter/image1.png",
          "alt": "Currency Converter program flow diagram",
          "caption": "Currency Converter program flow diagram"
        }
      ]
    },
    {
      "id": "currency-converter-source-page-09",
      "sourcePageStart": 9,
      "sourcePageEnd": 9,
      "sourcePages": [
        9
      ],
      "title": "2.2 Planning the Project",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Chronological Execution Flow"
        },
        {
          "type": "paragraph",
          "text": "An execution session of the converter progresses through 6 clear stages from initial menu launch to termination:"
        },
        {
          "type": "paragraph",
          "text": "/"
        },
        {
          "type": "image",
          "src": "/assets/projects/guides/currency-converter/image2.png",
          "alt": "Currency Converter class structure diagram",
          "caption": "Currency Converter class structure diagram"
        }
      ]
    },
    {
      "id": "currency-converter-source-page-10",
      "sourcePageStart": 10,
      "sourcePageEnd": 10,
      "sourcePages": [
        10
      ],
      "title": "2.3 System Architecture: Thinking in OOP (Component Responsibility Table)",
      "kind": "information",
      "checkpointIndex": 1,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Structuring our code into clean, single-responsibility components ensures high maintainability:"
        },
        {
          "type": "table",
          "columns": [
            "Component",
            "Responsibility"
          ],
          "rows": [
            [
              "Unit Ratios / Catalogs",
              "Stores conversion ratios relative to base units (USD, Meter, Kilogram)."
            ],
            [
              "Mathematical Engines",
              "Executes linear pivot transformations (convert_currency, convert_length, convert_weight)."
            ],
            [
              "Thermodynamic Engine",
              "Computes offset-based temperature math and evaluates Absolute Zero boundary checks."
            ],
            [
              "Defensive Input Parser",
              "Sanitizes numeric inputs against negative bounds and matches unit codes case-insensitively."
            ],
            [
              "Interactive Handlers",
              "Prompts user, gathers inputs, invokes calculation, and renders formatted result cards."
            ],
            [
              "Main Navigation Loop",
              "Orchestrates the top-level CLI menu, handles user routing, and executes graceful termination."
            ]
          ]
        }
      ]
    },
    {
      "id": "currency-converter-source-page-11",
      "sourcePageStart": 11,
      "sourcePageEnd": 11,
      "sourcePages": [
        11
      ],
      "title": "Chapter 3: Linear Pivot Conversion Engines",
      "kind": "task",
      "checkpointIndex": 2,
      "checkpointId": "currency-converter-task-3",
      "taskId": "currency-converter-task-3",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "3.1 Financial Conversions"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Calculating Normalized Currency Exchange"
        },
        {
          "type": "paragraph",
          "text": "Currency conversion follows a 2-step normalized ratio:"
        },
        {
          "type": "paragraph",
          "text": "1.  Normalize to Base (USD): Divide the input amount by the source currency rate."
        },
        {
          "type": "paragraph",
          "text": "2.  Project to Target: Multiply the USD amount by the target currency rate."
        },
        {
          "type": "paragraph",
          "text": "$$\\text{USD Amount} = \\frac{\\text{Amount}}{\\text{CURRENCY\\_RATES}[\\text{from\\_unit}]}$$"
        },
        {
          "type": "paragraph",
          "text": "$$\\text{Target Amount} = \\text{USD Amount} \\times \\text{CURRENCY\\_RATES}[\\text{to\\_unit}]$$"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 3 — Implement Currency conversion function"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement convert_currency(amount, from_unit, to_unit) (or convertCurrency(amount, fromUnit, toUnit)):"
        },
        {
          "type": "paragraph",
          "text": "Think of exchanging foreign banknotes into US Dollars at an international airport terminal."
        },
        {
          "type": "paragraph",
          "text": "Goal: Normalize the input amount into the universal base currency (USD)."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Pivot Input Amount to Standard Base (USD)☐  Compute amount_in_usd = amount / CURRENCY_RATES[from_unit]."
        },
        {
          "type": "paragraph",
          "text": "Think of exchanging US Dollars into local cash upon arriving in your destination country."
        },
        {
          "type": "paragraph",
          "text": "Goal: Multiply the normalized USD amount by the target currency rate."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Project Base Amount to Target Currency☐  Return amount_in_usd * CURRENCY_RATES[to_unit]."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-12",
      "sourcePageStart": 12,
      "sourcePageEnd": 12,
      "sourcePages": [
        12
      ],
      "title": "Milestone Checkpoint: Currency Conversion Engine Operational!",
      "kind": "information",
      "checkpointIndex": 2,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed the foreign exchange calculation engine:"
        },
        {
          "type": "paragraph",
          "text": "☑  Base Normalization: Scaled input currencies cleanly through USD."
        },
        {
          "type": "paragraph",
          "text": "☑  Target Projection: Computed exact cross-currency exchange without pairwise tables."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Test convert_currency(100.0, \"EUR\", \"USD\"). Since EUR is 0.92, $100 / 0.92 \\approx 108.70$ USD."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-13",
      "sourcePageStart": 13,
      "sourcePageEnd": 13,
      "sourcePages": [
        13
      ],
      "title": "3.2 Distance & Spatial Measurement",
      "kind": "task",
      "checkpointIndex": 3,
      "checkpointId": "currency-converter-task-4",
      "taskId": "currency-converter-task-4",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Metric & Imperial Distance Conversions (Base: Meters)"
        },
        {
          "type": "paragraph",
          "text": "In the metric system, the Meter (m) is the base unit of length. All distance units can be defined by how many meters 1 unit contains:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "m (Meters): 1.0",
            "km (Kilometers): 1000.0",
            "mi (Miles): 1609.344",
            "ft (Feet): 0.3048",
            "in (Inches): 0.0254"
          ]
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 4 — Define Length conversion ratios (Base: Meters)"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Declare the LENGTH_RATIOS lookup table:"
        },
        {
          "type": "paragraph",
          "text": "Think of an architect's master reference tape calibrated strictly in meters."
        },
        {
          "type": "paragraph",
          "text": "Goal: Map distance abbreviations to their meter multipliers."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Declare Length Ratios Lookup Table☐  Declare dictionary or map LENGTH_RATIOS mapping: \"m\": 1.0, \"km\": 1000.0, \"mi\": 1609.344, \"ft\": 0.3048, \"in\": 0.0254."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-14",
      "sourcePageStart": 14,
      "sourcePageEnd": 14,
      "sourcePages": [
        14
      ],
      "title": "Milestone Checkpoint: Distance Ratios Configured!",
      "kind": "information",
      "checkpointIndex": 3,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established distance conversion constants:"
        },
        {
          "type": "paragraph",
          "text": "☑  5 Distance Units Defined: Mapped metric and imperial units to meters."
        },
        {
          "type": "paragraph",
          "text": "☑  High Precision Ratios: Mapped miles to 1609.344 and feet to 0.3048."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Lookup LENGTH_RATIOS[\"km\"]. Verify it equals 1000.0."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-15",
      "sourcePageStart": 15,
      "sourcePageEnd": 15,
      "sourcePages": [
        15
      ],
      "title": "Transforming Length Across Measurement Scales",
      "kind": "task",
      "checkpointIndex": 4,
      "checkpointId": "currency-converter-task-5",
      "taskId": "currency-converter-task-5",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Length conversion multiplies the input amount by the source ratio to get meters, then divides by the target ratio to get the target unit:"
        },
        {
          "type": "paragraph",
          "text": "$$\\text{Meters} = \\text{Amount} \\times \\text{LENGTH\\_RATIOS}[\\text{from\\_unit}]$$"
        },
        {
          "type": "paragraph",
          "text": "$$\\text{Target Distance} = \\frac{\\text{Meters}}{\\text{LENGTH\\_RATIOS}[\\text{to\\_unit}]}$$"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 5 — Implement Length conversion function"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement convert_length(amount, from_unit, to_unit) (or convertLength(amount, fromUnit, toUnit)):"
        },
        {
          "type": "paragraph",
          "text": "Think of unrolling a surveyor's measuring tape to measure total meters."
        },
        {
          "type": "paragraph",
          "text": "Goal: Convert the input distance into base meters."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Normalize Distance to Base Metric (Meters)☐  Compute amount_in_meters = amount * LENGTH_RATIOS[from_unit]."
        },
        {
          "type": "paragraph",
          "text": "Think of cutting the measured meters into segments matching your target unit."
        },
        {
          "type": "paragraph",
          "text": "Goal: Divide total meters by the target unit's meter ratio."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Project Base Distance to Target Unit☐  Return amount_in_meters / LENGTH_RATIOS[to_unit]."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-16",
      "sourcePageStart": 16,
      "sourcePageEnd": 16,
      "sourcePages": [
        16
      ],
      "title": "Milestone Checkpoint: Distance Transformation Operational!",
      "kind": "information",
      "checkpointIndex": 4,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented universal distance conversion:"
        },
        {
          "type": "paragraph",
          "text": "☑  Metric & Imperial Bridges: Seamlessly converted across kilometers, miles, and feet."
        },
        {
          "type": "paragraph",
          "text": "☑  Bidirectional Accuracy: Verified that converting meters to miles and back yields identical values."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Test convert_length(1.0, \"km\", \"m\"). Verify it returns 1000.0."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-17",
      "sourcePageStart": 17,
      "sourcePageEnd": 17,
      "sourcePages": [
        17
      ],
      "title": "3.3 Mass & Weight Measurement",
      "kind": "task",
      "checkpointIndex": 5,
      "checkpointId": "currency-converter-task-6",
      "taskId": "currency-converter-task-6",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Gravitational Mass Ratios (Base: Kilograms)"
        },
        {
          "type": "paragraph",
          "text": "For mass and weight, the standard base unit is the Kilogram (kg):"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "kg (Kilograms): 1.0",
            "g (Grams): 0.001",
            "lbs (Pounds): 0.45359237",
            "oz (Ounces): 0.028349523125"
          ]
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 6 — Define Weight conversion ratios (Base: Kilograms)"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Declare the WEIGHT_RATIOS lookup table:"
        },
        {
          "type": "paragraph",
          "text": "Think of setting standard calibration brass weights on an analytical scale."
        },
        {
          "type": "paragraph",
          "text": "Goal: Map mass abbreviations to their kilogram multipliers."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Declare Weight Ratios Lookup Table☐  Declare dictionary or map WEIGHT_RATIOS mapping: \"kg\": 1.0, \"g\": 0.001, \"lbs\": 0.45359237, \"oz\": 0.028349523125."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-18",
      "sourcePageStart": 18,
      "sourcePageEnd": 18,
      "sourcePages": [
        18
      ],
      "title": "Milestone Checkpoint: Mass Ratios Configured!",
      "kind": "information",
      "checkpointIndex": 5,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have established mass conversion constants:"
        },
        {
          "type": "paragraph",
          "text": "☑  4 Mass Units Configured: Mapped kg, g, lbs, and oz to kilograms."
        },
        {
          "type": "paragraph",
          "text": "☑  Standard Scientific Definitions: Stored the exact international avoirdupois pound definition ($0.45359237\\text{ kg}$)."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Lookup WEIGHT_RATIOS[\"g\"]. Verify it equals 0.001."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-19",
      "sourcePageStart": 19,
      "sourcePageEnd": 19,
      "sourcePages": [
        19
      ],
      "title": "Converting Between Metric and Avoirdupois Mass",
      "kind": "task",
      "checkpointIndex": 6,
      "checkpointId": "currency-converter-task-7",
      "taskId": "currency-converter-task-7",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Mass conversion follows the identical multiplication-division pivot formula as distance:"
        },
        {
          "type": "paragraph",
          "text": "$$\\text{Kilograms} = \\text{Amount} \\times \\text{WEIGHT\\_RATIOS}[\\text{from\\_unit}]$$"
        },
        {
          "type": "paragraph",
          "text": "$$\\text{Target Weight} = \\frac{\\text{Kilograms}}{\\text{WEIGHT\\_RATIOS}[\\text{to\\_unit}]}$$"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 7 — Implement Weight conversion function"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement convert_weight(amount, from_unit, to_unit) (or convertWeight(amount, fromUnit, toUnit)):"
        },
        {
          "type": "paragraph",
          "text": "Think of setting the bulk merchandise onto a warehouse floor scale calibrated in kilograms."
        },
        {
          "type": "paragraph",
          "text": "Goal: Convert input mass into base kilograms."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Normalize Mass to Base Metric (Kilograms)☐  Compute amount_in_kg = amount * WEIGHT_RATIOS[from_unit]."
        },
        {
          "type": "paragraph",
          "text": "Think of repackaging the bulk goods into smaller retail boxes sized in pounds or ounces."
        },
        {
          "type": "paragraph",
          "text": "Goal: Divide total kilograms by the target unit's kilogram ratio."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Project Base Mass to Target Unit☐  Return amount_in_kg / WEIGHT_RATIOS[to_unit]."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-20",
      "sourcePageStart": 20,
      "sourcePageEnd": 20,
      "sourcePages": [
        20
      ],
      "title": "Milestone Checkpoint: Mass Transformation Operational!",
      "kind": "information",
      "checkpointIndex": 6,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented universal mass conversion:"
        },
        {
          "type": "paragraph",
          "text": "☑  Dual Standard Support: Supported both metric (g, kg) and imperial (lbs, oz) scales."
        },
        {
          "type": "paragraph",
          "text": "☑  Precision Ratio Math: Evaluated fractional ratios without integer truncation."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Test convert_weight(1.0, \"kg\", \"g\"). Verify it returns 1000.0."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-21",
      "sourcePageStart": 21,
      "sourcePageEnd": 21,
      "sourcePages": [
        21
      ],
      "title": "Chapter 4: Non-Linear Temperature Mathematics",
      "kind": "task",
      "checkpointIndex": 7,
      "checkpointId": "currency-converter-task-8",
      "taskId": "currency-converter-task-8",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "4.1 Offset-Based Algebraic Transformations"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Non-Linear Thermodynamics & Absolute Zero"
        },
        {
          "type": "paragraph",
          "text": "Unlike currency, distance, or weight, temperature scales do not share a common zero point:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Water freezes at $0^\\circ\\text{C}$, $32^\\circ\\text{F}$, and $273.15\\text{ K}$.",
            "Because of these additive shifts, temperature cannot be solved with pure scalar ratios."
          ]
        },
        {
          "type": "paragraph",
          "text": "Furthermore, physics mandates that nothing can be colder than Absolute Zero ($0\\text{ K} = -273.15^\\circ\\text{C} = -459.67^\\circ\\text{F}$). Our application strictly prevents calculations below this physical floor."
        },
        {
          "type": "paragraph",
          "text": "The 2-Step Temperature Pivot:"
        },
        {
          "type": "paragraph",
          "text": "1.  To Celsius:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "If from F: $\\text{celsius} = (\\text{amount} - 32.0) \\times \\frac{5}{9}$",
            "If from K: $\\text{celsius} = \\text{amount} - 273.15$",
            "If from C: $\\text{celsius} = \\text{amount}$"
          ]
        },
        {
          "type": "paragraph",
          "text": "2.  From Celsius to Target:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "If to F: $\\text{target} = (\\text{celsius} \\times \\frac{9}{5}) + 32.0$",
            "If to K: $\\text{target} = \\text{celsius} + 273.15$",
            "If to C: $\\text{target} = \\text{celsius}$"
          ]
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 8 — Implement Temperature conversion function (Base: Celsius)"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement is_below_absolute_zero() and convert_temperature():"
        },
        {
          "type": "paragraph",
          "text": "Think of a laboratory safety interlock that prevents setting a freezer below physical absolute zero."
        },
        {
          "type": "paragraph",
          "text": "Goal: Reject temperatures below Absolute Zero (0 K, -273.15 C, -459.67 F)."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Validate Absolute Zero Physical Boundary☐  In is_below_absolute_zero(amount, unit), return True if (unit == \"C\" and amount < -273.15) or (unit == \"F\" and amount < -459.67) or (unit == \"K\" and amount < 0.0); else False."
        },
        {
          "type": "paragraph",
          "text": "Think of calibrating an unfamiliar thermometer against a standard Celsius mercury tube."
        },
        {
          "type": "paragraph",
          "text": "Goal: Normalize input temperature to Celsius using appropriate offset algebra."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Convert Input Scale to Base Celsius☐  If from_unit == \"C\", celsius = amount; if \"F\", celsius = (amount - 32.0) * 5.0 / 9.0; if \"K\", celsius = amount - 273.15."
        },
        {
          "type": "paragraph",
          "text": "Think of adjusting the temperature dial to the customer's desired regional scale."
        },
        {
          "type": "paragraph",
          "text": "Goal: Project Celsius temperature into target scale (C, F, or K)."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Project Base Celsius to Target Scale☐  If to_unit == \"C\", return celsius; if \"F\", return (celsius * 9.0 / 5.0) + 32.0; if \"K\", return celsius + 273.15."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-22",
      "sourcePageStart": 22,
      "sourcePageEnd": 22,
      "sourcePages": [
        22
      ],
      "title": "Milestone Checkpoint: Thermodynamic Engine & Physical Safeguards Verified!",
      "kind": "information",
      "checkpointIndex": 7,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented thermodynamic conversion and physical boundary validation:"
        },
        {
          "type": "paragraph",
          "text": "☑  Absolute Zero Safeguard: Prevented impossible temperatures below Absolute Zero."
        },
        {
          "type": "paragraph",
          "text": "☑  Non-Linear Transformations: Evaluated additive offsets accurately across C, F, and K."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Test convert_temperature(100.0, \"C\", \"F\") -> returns 212.0."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Test convert_temperature(0.0, \"C\", \"K\") -> returns 273.15."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Test is_below_absolute_zero(-300.0, \"C\") -> returns True."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-23",
      "sourcePageStart": 23,
      "sourcePageEnd": 23,
      "sourcePages": [
        23
      ],
      "title": "Chapter 5: Input Sanitation & Interactive Modules",
      "kind": "task",
      "checkpointIndex": 8,
      "checkpointId": "currency-converter-task-9",
      "taskId": "currency-converter-task-9",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "5.1 Robust Numeric Parsing"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Defensive Programming: Numeric Boundary Traps"
        },
        {
          "type": "paragraph",
          "text": "A command-line tool must never crash when a user types letters, symbols, or negative quantities where positive amounts are required."
        },
        {
          "type": "paragraph",
          "text": "We construct two dedicated validation helpers:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "1.  get_positive_number(prompt): Guarantees input is a valid non-negative float."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "2.  get_temperature_number(prompt, unit): Allows negative numbers but rejects values below Absolute Zero for that unit."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 9 — Validate numeric input"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement get_positive_number(prompt) and get_temperature_number(prompt, unit):"
        },
        {
          "type": "paragraph",
          "text": "Think of a turnstile coin slot that rejects bent coins or negative tokens."
        },
        {
          "type": "paragraph",
          "text": "Goal: Continually prompt until a valid non-negative float is entered."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Read and Validate Non-Negative Number☐  In get_positive_number(prompt), run a loop parsing float input. If negative, print error and re-prompt; if non-numeric, catch error, print message, and re-prompt."
        },
        {
          "type": "paragraph",
          "text": "Think of a smart thermostat rejecting temperatures colder than deep space."
        },
        {
          "type": "paragraph",
          "text": "Goal: Continually prompt until a temperature at or above Absolute Zero is entered."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Read and Validate Bounded Temperature☐  In get_temperature_number(prompt, unit), parse float input and check is_below_absolute_zero(). If below bound, print error and re-prompt; otherwise return value."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-24",
      "sourcePageStart": 24,
      "sourcePageEnd": 24,
      "sourcePages": [
        24
      ],
      "title": "Milestone Checkpoint: Numeric Input Sanitizer Operational!",
      "kind": "information",
      "checkpointIndex": 8,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented defensive numeric parsing:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "☑  Crash Prevention: Trapped ValueError / parse exceptions gracefully."
        },
        {
          "type": "paragraph",
          "text": "☑  Domain Bounds Enforced: Guarded against negative quantities and sub-absolute zero inputs."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call get_positive_number(\"Enter: \"). Enter \"abc\" followed by \"-5\" followed by \"10\". Verify it cleanly re-prompts and returns 10.0."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-25",
      "sourcePageStart": 25,
      "sourcePageEnd": 25,
      "sourcePages": [
        25
      ],
      "title": "5.2 Case-Insensitive Unit Selection",
      "kind": "task",
      "checkpointIndex": 9,
      "checkpointId": "currency-converter-task-10",
      "taskId": "currency-converter-task-10",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Flexible User Experience: Case-Insensitive Matching"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Users may enter units in lowercase (\"usd\"), uppercase (\"USD\"), or mixed case (\"Usd\"). A robust CLI tool accepts any casing and matches it to the canonical unit identifier."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 10 — Validate unit selections"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement get_valid_unit(prompt, allowed_units):"
        },
        {
          "type": "paragraph",
          "text": "Think of an automated flight ticket scanner that accepts airport codes in either capital or lowercase letters."
        },
        {
          "type": "paragraph",
          "text": "Goal: Normalize user input and return the canonical unit string."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Normalize Case and Match Against Allowed Units☐  In a loop, read input, strip whitespace, and check if lowercase input equals lowercase of any item in allowed_units. If match found, return canonical original string; else print allowed list and re-prompt."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-26",
      "sourcePageStart": 26,
      "sourcePageEnd": 26,
      "sourcePages": [
        26
      ],
      "title": "Milestone Checkpoint: Unit Selector Validation Complete!",
      "kind": "information",
      "checkpointIndex": 9,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented case-insensitive unit validation:"
        },
        {
          "type": "paragraph",
          "text": "☑  Case Tolerance: Allowed user to type in lowercase, uppercase, or mixed case."
        },
        {
          "type": "paragraph",
          "text": "☑  Canonical Return: Guaranteed return value matches the exact dictionary key casing."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Call get_valid_unit(\"Unit: \", [\"USD\", \"EUR\"]). Enter \"usd\". Verify it returns \"USD\"."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-27",
      "sourcePageStart": 27,
      "sourcePageEnd": 27,
      "sourcePages": [
        27
      ],
      "title": "5.3 Modular Sub-Workflows",
      "kind": "task",
      "checkpointIndex": 10,
      "checkpointId": "currency-converter-task-11",
      "taskId": "currency-converter-task-11",
      "blocks": [
        {
          "type": "heading",
          "level": 4,
          "text": "Single Responsibility Interactive Handlers"
        },
        {
          "type": "paragraph",
          "text": "Each conversion category has its own interactive sub-workflow:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "1.  handle_currency(): Prompts for currencies, reads amount, displays exchange result and 1-unit exchange rate."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "2.  handle_length(): Prompts for distance units, displays converted length and unit ratio."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "3.  handle_weight(): Prompts for weight units, displays converted mass and unit ratio."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "4.  handle_temperature(): Prompts for thermal scales, validates absolute zero, displays converted temperature."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 11 — Build interactive conversion handlers"
        },
        {
          "type": "paragraph",
          "text": "Implement the 4 category handler functions:"
        },
        {
          "type": "paragraph",
          "text": "Think of opening the Currency Exchange teller window."
        },
        {
          "type": "paragraph",
          "text": "Goal: Coordinate unit inputs, conversion calculation, and formatted currency output."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Build Currency Conversion Handler☐  In handle_currency(), prompt source and target currencies, read positive amount, compute result and rate, and print formatted to 2 and 4 decimal places."
        },
        {
          "type": "paragraph",
          "text": "Think of opening the Distance & Land Surveying desk."
        },
        {
          "type": "paragraph",
          "text": "Goal: Coordinate distance inputs, conversion calculation, and formatted length output."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Build Length Conversion Handler☐  In handle_length(), prompt source and target units, read distance, compute result and ratio, and print formatted to 4 decimal places."
        },
        {
          "type": "paragraph",
          "text": "Think of opening the Freight & Cargo scale station."
        },
        {
          "type": "paragraph",
          "text": "Goal: Coordinate weight inputs, conversion calculation, and formatted mass output."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Build Weight Conversion Handler☐  In handle_weight(), prompt source and target units, read mass, compute result and ratio, and print formatted to 4 decimal places."
        },
        {
          "type": "paragraph",
          "text": "Think of opening the Scientific Thermal Laboratory station."
        },
        {
          "type": "paragraph",
          "text": "Goal: Coordinate temperature inputs, validate bounds, and display converted temperature."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Build Temperature Conversion Handler☐  In handle_temperature(), prompt source and target scales, read temperature bounded by Absolute Zero, compute conversion, and print formatted to 2 decimal places."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "--- CURRENCY CONVERTER ---\nSupported Currencies: USD, EUR, GBP, INR, JPY, CAD\nEnter Source Currency: USD\nEnter Target Currency: EUR\nEnter amount in USD: 100\n\n>> RESULT: 100.00 USD = 92.00 EUR\n   (Exchange Rate: 1 USD = 0.9200 EUR)"
        }
      ]
    },
    {
      "id": "currency-converter-source-page-28",
      "sourcePageStart": 28,
      "sourcePageEnd": 28,
      "sourcePages": [
        28
      ],
      "title": "Milestone Checkpoint: Interactive Conversion Sub-Workflows Verified!",
      "kind": "information",
      "checkpointIndex": 10,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have implemented all 4 category sub-workflows:"
        },
        {
          "type": "paragraph",
          "text": "☑  4 Specialized Handlers: Structured clean interactive flows for Currency, Length, Weight, and Temperature."
        },
        {
          "type": "paragraph",
          "text": "☑  Precision Formatting: Formatted currency/temperature to 2 decimals and ratios/distances/masses to 4 decimals."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Run handle_currency(), enter USD, EUR, and 100. Verify the result prints $92.00 EUR."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-29",
      "sourcePageStart": 29,
      "sourcePageEnd": 29,
      "sourcePages": [
        29
      ],
      "title": "Chapter 6: Session Operations & Application Assembly",
      "kind": "task",
      "checkpointIndex": 11,
      "checkpointId": "currency-converter-task-12",
      "taskId": "currency-converter-task-12",
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "6.1 Main Menu & Session Navigation"
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Continuous Turn-Based Operation: The Navigation Loop"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "The application lifecycle is governed by a persistent while True main loop that displays a clear category menu, accepts choices 1 through 5, routes execution to the appropriate handler, and exits cleanly upon option 5."
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Task 12 — Implement main menu loop and application assembly"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement main() with interactive menu routing and exit workflow:"
        },
        {
          "type": "paragraph",
          "text": "Think of illuminating a digital navigation kiosk in a train station."
        },
        {
          "type": "paragraph",
          "text": "Goal: Print the formatted category menu header."
        },
        {
          "type": "paragraph",
          "text": "STEP 1 — Render Interactive Menu Banner☐  Print the framed header with options 1: Currency, 2: Length, 3: Weight, 4: Temperature, 5: Exit."
        },
        {
          "type": "paragraph",
          "text": "Think of pressing a button on the kiosk to select your desired service."
        },
        {
          "type": "paragraph",
          "text": "Goal: Read choice string and branch execution to the matching handler."
        },
        {
          "type": "paragraph",
          "text": "STEP 2 — Prompt and Route User Selection☐  Prompt user for choice: if \"1\" call handle_currency(); if \"2\" call handle_length(); if \"3\" call handle_weight(); if \"4\" call handle_temperature()."
        },
        {
          "type": "paragraph",
          "text": "Think of a friendly clerk wishing you safe travels as you leave the bureau."
        },
        {
          "type": "paragraph",
          "text": "Goal: Handle option 5 by displaying farewell message and breaking loop."
        },
        {
          "type": "paragraph",
          "text": "STEP 3 — Handle Exit and Farewell☐  If choice is \"5\", print \"\\nThank you for using Multi-Unit & Currency Converter CLI. Goodbye!\" and break loop. If invalid, print warning and re-prompt."
        },
        {
          "type": "paragraph",
          "text": "Think of wiring the main power switch to initialize the system when turned on."
        },
        {
          "type": "paragraph",
          "text": "Goal: Wrap main execution inside standard script execution entry point guard."
        },
        {
          "type": "paragraph",
          "text": "STEP 4 — Assemble Main Entry Point Guard☐  Call print_welcome() at the start of main() and protect execution with if __name__ == \"__main__\": main() (or standard C++/Java main conventions)."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Expected Terminal Interaction & Output:"
        },
        {
          "type": "expected-output",
          "output": "Welcome to Multi-Unit & Currency Converter CLI!\n\n========================================\n   MULTI-UNIT & CURRENCY CONVERTER CLI   \n========================================\n1. Currency Converter (USD, EUR, GBP, INR, JPY, CAD)\n2. Length Converter (m, km, mi, ft, in)\n3. Weight Converter (kg, g, lbs, oz)\n4. Temperature Converter (C, F, K)\n5. Exit\n----------------------------------------\nEnter your choice (1-5): 5\n\nThank you for using Multi-Unit & Currency Converter CLI. Goodbye!"
        }
      ]
    },
    {
      "id": "currency-converter-source-page-30",
      "sourcePageStart": 30,
      "sourcePageEnd": 30,
      "sourcePages": [
        30
      ],
      "title": "Milestone Checkpoint: Full Multi-Unit Converter Application Complete!",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "You have completed the entire Multi-Unit and Currency Converter project:"
        },
        {
          "type": "paragraph",
          "text": "☑  End-to-End Navigation: Successfully navigated between menu categories, conversion runs, and clean exit."
        },
        {
          "type": "paragraph",
          "text": "☑  Architectural Completeness: Unified linear base pivoting, thermodynamic mathematics, and defensive input parsing."
        },
        {
          "type": "heading",
          "level": 4,
          "text": "Driver Verification Test:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Run your application executable (python Converter.py, ./Converter, or java Converter). Test converting currency, then length, and finally exit cleanly via option 5."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-31",
      "sourcePageStart": 31,
      "sourcePageEnd": 31,
      "sourcePages": [
        31
      ],
      "title": "Chapter 7: Reflect & Expand",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "heading",
          "level": 3,
          "text": "7.1 What You Have Built"
        },
        {
          "type": "paragraph",
          "text": "You have engineered a production-ready, extensible Multi-Unit and Currency Conversion suite. Let us review the foundational engineering patterns and computer science concepts you practiced:"
        },
        {
          "type": "table",
          "columns": [
            "Feature Area",
            "Architectural Concept",
            "Practical Skill Practiced"
          ],
          "rows": [
            [
              "Architectural Normalization",
              "Base Unit Pivot Pattern",
              "Reduced conversion complexity from combinatorial $O(N^2)$ pairwise formulas to an elegant $O(N)$ normalized ratio model."
            ],
            [
              "Associative Data Structures",
              "Hash Maps / Dictionaries",
              "Utilized key-value lookup tables for instantaneous $O(1)$ unit ratio retrieval."
            ],
            [
              "Domain Constraints",
              "Physical Boundary Enforcement",
              "Guarded numeric calculations with thermodynamic laws (Absolute Zero) and non-negative physical bounds."
            ],
            [
              "Non-Linear Transformations",
              "Algebraic Offset Math",
              "Managed thermal scale conversion requiring both multiplication factors and additive degree offsets."
            ],
            [
              "Defensive Programming",
              "Resilient Input Parsing",
              "Shielded the CLI from malformed strings, case variations, and negative inputs using defensive retry loops."
            ],
            [
              "Session Architecture",
              "Multi-Level Menu Systems",
              "Structured clean hierarchical navigation routing across 4 distinct measurement sub-workflows."
            ]
          ]
        }
      ]
    },
    {
      "id": "currency-converter-source-page-32",
      "sourcePageStart": 32,
      "sourcePageEnd": 32,
      "sourcePages": [
        32
      ],
      "title": "7.2 Extension Ideas",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Now that you have constructed a solid, modular conversion architecture, consider expanding your project with these advanced capabilities:"
        },
        {
          "type": "paragraph",
          "text": "1.  Live Foreign Exchange REST API:"
        },
        {
          "type": "paragraph",
          "text": "Connect your currency engine to a public live exchange rate API (such as Open Exchange Rates or Frankfurter API) using HTTP requests to fetch real-time market rates dynamically."
        },
        {
          "type": "paragraph",
          "text": "2.  Liquid Volume & Culinary Measurements:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Add a 5th module supporting volume units: Liters (L), Milliliters (mL), Gallons (gal), Quarts (qt), Pints (pt), and Cups."
        },
        {
          "type": "paragraph",
          "text": "3.  Speed & Velocity Calculations:"
        },
        {
          "type": "heading",
          "level": 3,
          "text": "Implement a velocity converter connecting meters per second (m/s), kilometers per hour (km/h), miles per hour (mph), and nautical knots (kn)."
        },
        {
          "type": "paragraph",
          "text": "4.  Persistent Transaction History:"
        },
        {
          "type": "paragraph",
          "text": "Maintain an audit log tracking every conversion performed during the session, with an option in the main menu to display a formatted summary table or export to CSV."
        }
      ]
    },
    {
      "id": "currency-converter-source-page-33",
      "sourcePageStart": 33,
      "sourcePageEnd": 33,
      "sourcePages": [
        33
      ],
      "title": "7.3 Share What You Built! Time to Showcase Your Project!",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Your Multi-Unit and Currency Converter is an impressive demonstration of practical, clean software engineering. Share your work with the engineering community:"
        },
        {
          "type": "list",
          "ordered": false,
          "items": [
            "Create a GitHub Repository: Push your code with clear commit messages matching each task milestone.",
            "Write a Professional README: Include a project overview, conversion formulas, ASCII/Mermaid architecture diagrams, and sample CLI transcripts.",
            "Cross-Language Showcase: Demonstrate polyglot software engineering by maintaining synchronized reference implementations in Python, C++, and Java in the same repository."
          ]
        }
      ]
    },
    {
      "id": "currency-converter-source-page-34",
      "sourcePageStart": 34,
      "sourcePageEnd": 34,
      "sourcePages": [
        34
      ],
      "title": "Appendix: Full Pseudocode Reference",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Below is the complete, language-neutral algorithmic pseudocode for the entire Multi-Unit and Currency Converter application, matching the exact chronological order of Tasks 1 through 12:"
        },
        {
          "type": "code",
          "code": "// Task 1 - Create the entry file and print welcome header\nFUNCTION printWelcome():\n    // Step 2: Welcome Banner Output\n    PRINT \"Welcome to Multi-Unit & Currency Converter CLI!\"\n\n\n// Task 2 - Define Currency rates table (Base: USD)\n// Step 1: Declare Currency Rates Lookup Table\nCONSTANT CURRENCY_RATES = {\n    \"USD\": 1.0,\n    \"EUR\": 0.92,\n    \"GBP\": 0.79,\n    \"INR\": 83.0,\n    \"JPY\": 155.0,\n    \"CAD\": 1.36\n}\n\n\n// Task 3 - Implement Currency conversion function\nFUNCTION convertCurrency(amount, fromUnit, toUnit):\n    // Step 1: Pivot Input Amount to Standard Base (USD)\n    amountInUsd = amount / CURRENCY_RATES[fromUnit]\n\n    // Step 2: Project Base Amount to Target Currency\n    RETURN amountInUsd * CURRENCY_RATES[toUnit]\n\n\n// Task 4 - Define Length conversion ratios (Base: Meters)\n// Step 1: Declare Length Ratios Lookup Table\nCONSTANT LENGTH_RATIOS = {\n    \"m\": 1.0,\n    \"km\": 1000.0,\n    \"mi\": 1609.344,\n    \"ft\": 0.3048,\n    \"in\": 0.0254\n}\n\n\n// Task 5 - Implement Length conversion function\nFUNCTION convertLength(amount, fromUnit, toUnit):\n    // Step 1: Normalize Distance to Base Metric (Meters)\n    amountInMeters = amount * LENGTH_RATIOS[fromUnit]\n\n    // Step 2: Project Base Distance to Target Unit\n    RETURN amountInMeters / LENGTH_RATIOS[toUnit]\n\n\n// Task 6 - Define Weight conversion ratios (Base: Kilograms)\n// Step 1: Declare Weight Ratios Lookup Table\nCONSTANT WEIGHT_RATIOS = {\n    \"kg\": 1.0,\n    \"g\": 0.001,\n    \"lbs\": 0.45359237,\n    \"oz\": 0.028349523125\n}"
        }
      ]
    },
    {
      "id": "currency-converter-source-page-35",
      "sourcePageStart": 35,
      "sourcePageEnd": 35,
      "sourcePages": [
        35
      ],
      "title": "Source page 35",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "// Task 7 - Implement Weight conversion function\nFUNCTION convertWeight(amount, fromUnit, toUnit):\n    // Step 1: Normalize Mass to Base Metric (Kilograms)\n    amountInKg = amount * WEIGHT_RATIOS[fromUnit]\n\n    // Step 2: Project Base Mass to Target Unit\n    RETURN amountInKg / WEIGHT_RATIOS[toUnit]\n\n\n// Task 8 - Implement Temperature conversion function (Base: Celsius)\nFUNCTION isBelowAbsoluteZero(amount, unit):\n    // Step 1: Validate Absolute Zero Physical Boundary\n    IF unit == \"C\" AND amount < -273.15: RETURN TRUE\n    IF unit == \"F\" AND amount < -459.67: RETURN TRUE\n    IF unit == \"K\" AND amount < 0.0: RETURN TRUE\n    RETURN FALSE\n\nFUNCTION convertTemperature(amount, fromUnit, toUnit):\n    // Step 2: Convert Input Scale to Base Celsius\n    IF fromUnit == \"C\":\n        celsius = amount\n    ELSE IF fromUnit == \"F\":\n        celsius = (amount - 32.0) * 5.0 / 9.0\n    ELSE IF fromUnit == \"K\":\n        celsius = amount - 273.15\n    ELSE:\n        RETURN 0.0\n\n    // Step 3: Project Base Celsius to Target Scale\n    IF toUnit == \"C\":\n        RETURN celsius\n    ELSE IF toUnit == \"F\":\n        RETURN (celsius * 9.0 / 5.0) + 32.0\n    ELSE IF toUnit == \"K\":\n        RETURN celsius + 273.15\n    RETURN 0.0\n\n\n// Task 9 - Validate numeric input\nFUNCTION getPositiveNumber(prompt):\n    // Step 1: Read and Validate Non-Negative Number\n    LOOP:\n        PROMPT prompt\n        val = PARSE_FLOAT(READ_INPUT())\n        IF val IS VALID AND val >= 0.0:\n            RETURN val\n        ELSE IF val IS VALID AND val < 0.0:\n            PRINT \"Error: Amount cannot be negative. Please enter a positive value.\"\n        ELSE:\n            PRINT \"Error: Invalid numeric input. Please enter a valid number.\"\n\nFUNCTION getTemperatureNumber(prompt, unit):\n    // Step 2: Read and Validate Bounded Temperature\n    LOOP:\n        PROMPT prompt\n        val = PARSE_FLOAT(READ_INPUT())\n        IF val IS VALID:\n            IF isBelowAbsoluteZero(val, unit):\n                PRINT \"Error: Temperature cannot be below Absolute Zero.\"\n            ELSE:\n                RETURN val\n        ELSE:"
        }
      ]
    },
    {
      "id": "currency-converter-source-page-36",
      "sourcePageStart": 36,
      "sourcePageEnd": 36,
      "sourcePages": [
        36
      ],
      "title": "Source page 36",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "PRINT \"Error: Invalid numeric input. Please enter a valid number.\"\n\n\n// Task 10 - Validate unit selections\nFUNCTION getValidUnit(prompt, allowedUnits):\n    // Step 1: Normalize Case and Match Against Allowed Units\n    LOOP:\n        PROMPT prompt\n        inputStr = TRIM(READ_INPUT())\n        FOR EACH original IN allowedUnits:\n            IF TO_LOWER(inputStr) == TO_LOWER(original):\n                RETURN original\n        PRINT \"Error: Invalid unit. Allowed options: \" + JOIN(allowedUnits, \", \")\n\n\n// Task 11 - Build interactive conversion handlers\nFUNCTION handleCurrency():\n    // Step 1: Build Currency Conversion Handler\n    PRINT \"\\n--- CURRENCY CONVERTER ---\"\n    units = [\"USD\", \"EUR\", \"GBP\", \"INR\", \"JPY\", \"CAD\"]\n    PRINT \"Supported Currencies: \" + JOIN(units, \", \")\n    fromCurr = getValidUnit(\"Enter Source Currency: \", units)\n    toCurr = getValidUnit(\"Enter Target Currency: \", units)\n    amount = getPositiveNumber(\"Enter amount in \" + fromCurr + \": \")\n\n    result = convertCurrency(amount, fromCurr, toCurr)\n    rate = convertCurrency(1.0, fromCurr, toCurr)\n\n    PRINT \">> RESULT: \" + FORMAT_2_DECIMALS(amount) + \" \" + fromCurr + \" = \" + FORMAT_2_DECIMALS(result) + \" \" + toCurr\n    PRINT \"   (Exchange Rate: 1 \" + fromCurr + \" = \" + FORMAT_4_DECIMALS(rate) + \" \" + toCurr + \")\"\n\nFUNCTION handleLength():\n    // Step 2: Build Length Conversion Handler\n    PRINT \"\\n--- LENGTH CONVERTER ---\"\n    units = [\"m\", \"km\", \"mi\", \"ft\", \"in\"]\n    PRINT \"Supported Units: m, km, mi, ft, in\"\n    fromU = getValidUnit(\"Enter Source Unit: \", units)\n    toU = getValidUnit(\"Enter Target Unit: \", units)\n    amount = getPositiveNumber(\"Enter distance in \" + fromU + \": \")\n\n    result = convertLength(amount, fromU, toU)\n    rate = convertLength(1.0, fromU, toU)\n\n    PRINT \">> RESULT: \" + FORMAT_4_DECIMALS(amount) + \" \" + fromU + \" = \" + FORMAT_4_DECIMALS(result) + \" \" + toU\n    PRINT \"   (Ratio: 1 \" + fromU + \" = \" + FORMAT_4_DECIMALS(rate) + \" \" + toU + \")\"\n\nFUNCTION handleWeight():\n    // Step 3: Build Weight Conversion Handler\n    PRINT \"\\n--- WEIGHT CONVERTER ---\"\n    units = [\"kg\", \"g\", \"lbs\", \"oz\"]\n    PRINT \"Supported Units: kg, g, lbs, oz\"\n    fromU = getValidUnit(\"Enter Source Unit: \", units)\n    toU = getValidUnit(\"Enter Target Unit: \", units)\n    amount = getPositiveNumber(\"Enter weight in \" + fromU + \": \")\n\n    result = convertWeight(amount, fromU, toU)\n    rate = convertWeight(1.0, fromU, toU)\n\n    PRINT \">> RESULT: \" + FORMAT_4_DECIMALS(amount) + \" \" + fromU + \" = \" +"
        }
      ]
    },
    {
      "id": "currency-converter-source-page-37",
      "sourcePageStart": 37,
      "sourcePageEnd": 37,
      "sourcePages": [
        37
      ],
      "title": "Source page 37",
      "kind": "information",
      "checkpointIndex": 11,
      "checkpointId": null,
      "taskId": null,
      "blocks": [
        {
          "type": "code",
          "code": "FORMAT_4_DECIMALS(result) + \" \" + toU\n    PRINT \"   (Ratio: 1 \" + fromU + \" = \" + FORMAT_4_DECIMALS(rate) + \" \" + toU + \")\"\n\nFUNCTION handleTemperature():\n    // Step 4: Build Temperature Conversion Handler\n    PRINT \"\\n--- TEMPERATURE CONVERTER ---\"\n    units = [\"C\", \"F\", \"K\"]\n    PRINT \"Supported Scales: C, F, K\"\n    fromU = getValidUnit(\"Enter Source Scale: \", units)\n    toU = getValidUnit(\"Enter Target Scale: \", units)\n    amount = getTemperatureNumber(\"Enter temperature in \" + fromU + \": \", fromU)\n\n    result = convertTemperature(amount, fromU, toU)\n\n    PRINT \">> RESULT: \" + FORMAT_2_DECIMALS(amount) + \" \" + fromU + \" = \" + FORMAT_2_DECIMALS(result) + \" \" + toU\n\n\n// Task 12 - Implement main menu loop and application assembly\nFUNCTION main():\n    // Step 4: Assemble Main Entry Point Guard\n    printWelcome()\n\n    LOOP:\n        // Step 1: Render Interactive Menu Banner\n        PRINT \"\\n========================================\"\n        PRINT \"   MULTI-UNIT & CURRENCY CONVERTER CLI   \"\n        PRINT \"========================================\"\n        PRINT \"1. Currency Converter (USD, EUR, GBP, INR, JPY, CAD)\"\n        PRINT \"2. Length Converter (m, km, mi, ft, in)\"\n        PRINT \"3. Weight Converter (kg, g, lbs, oz)\"\n        PRINT \"4. Temperature Converter (C, F, K)\"\n        PRINT \"5. Exit\"\n        PRINT \"----------------------------------------\"\n\n        // Step 2: Prompt and Route User Selection\n        choice = TRIM(READ_INPUT(\"Enter your choice (1-5): \"))\n\n        IF choice == \"1\":\n            handleCurrency()\n        ELSE IF choice == \"2\":\n            handleLength()\n        ELSE IF choice == \"3\":\n            handleWeight()\n        ELSE IF choice == \"4\":\n            handleTemperature()\n        ELSE IF choice == \"5\":\n            // Step 3: Handle Exit and Farewell\n            PRINT \"\\nThank you for using Multi-Unit & Currency Converter CLI. Goodbye!\"\n            BREAK\n        ELSE:\n            PRINT \"Invalid choice. Please enter a number between 1 and 5.\""
        }
      ]
    }
  ]
});

export const sourceGuidePagesFor = (projectId) => PROJECT_GUIDE_SOURCE_PAGES[projectId] ?? [];
