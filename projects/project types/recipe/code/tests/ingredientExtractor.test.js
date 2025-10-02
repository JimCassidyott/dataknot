// ingredientExtractor.test.js
// Sample Jest tests for ingredient extraction functionality

// This assumes you will implement extractIngredients in ../src/ingredientExtractor.js
const extractIngredients = require('../src/ingredientExtractor');

describe('Ingredient Extractor', () => {
  test('should extract a list of ingredients from a simple recipe', () => {
    const recipeText = `
      2 cups flour
      1 cup sugar
      3 eggs
    `;
    const ingredients = extractIngredients(recipeText);
    expect(ingredients).toEqual([
      { name: 'flour', quantity: '2 cups' },
      { name: 'sugar', quantity: '1 cup' },
      { name: 'eggs', quantity: '3' }
    ]);
  });

  test('should handle empty recipe text', () => {
    const ingredients = extractIngredients('');
    expect(ingredients).toEqual([]);
  });
}); 