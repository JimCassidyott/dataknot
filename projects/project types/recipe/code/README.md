# Recipe Types Code

## Introduction

This folder contains the source code and related resources for the Recipe Types project. The project is designed to facilitate collaborative meal planning between humans and AI, with advanced features for recipe management, ingredient analysis, and more.

## Installation

1. Clone the repository or copy the code folder to your project directory.
2. Install any required dependencies as specified in the project documentation or requirements files.

## Usage

- Use the provided scripts and modules to interact with recipe data, ingredient extraction, and classification features.
- Integrate with the main Recipe Navigator application for full functionality.

## Features

- Collaborative meal planning
- AI-generated recipe suggestions
- Ingredient extraction and classification
- Nutritional and dietary analysis
- Shopping list generation
- Support for reading recipes from files or pasted text

## Folder Structure

- `src/` - Source code files
- `tests/` - Unit and integration tests
- `data/` - Sample data and resources

## Context Files and AI Instructions

This project uses a `context` folder to store context files (YAML or other formats). Each context file contains specific instructions for the AI, describing how to interpret or process the content that is passed along with it. When using AI features, you can pass both your data (such as a recipe) and a context file, which guides the AI on what to do with the content (e.g., extract ingredients, classify data, etc.).

This approach allows for flexible, reusable, and clearly defined instructions for different AI-powered tasks within the project type.

## The Role of AI in This Application

In this project, AI is used to perform tasks that would normally be handled by traditional code, such as tagging, parsing, and cleaning data. By leveraging the AI's understanding of human language, we can instruct it (using context files) to process data in w alrightys that would otherwise require complex programming logic.

This approach allows for more flexible and adaptive data processing, but it also introduces a "person-in-the-middle" workflow: a human provides the data and selects or crafts the appropriate context instructions for the AI, ensuring the results meet the project's needs.

## Contributing

Contributions are welcome! Please open issues or submit pull requests for improvements, bug fixes, or new features.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
