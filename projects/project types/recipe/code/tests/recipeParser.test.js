/**
 * Recipe Parser Test Suite
 * Tests for recipe parsing functionality that takes context and recipe string parameters
 * 
 * @author: AI Assistant
 * @date: 2024
 */

// This assumes you will implement parseRecipe in ../src/recipeParser.js
const parseRecipe = require('../src/recipeParser');

describe('Recipe Parser', () => {
  // Test context object that can be passed to the parser
  const testContext = {
    language: 'en',
    cuisine: 'american',
    difficulty: 'intermediate',
    parseOptions: {
      extractIngredients: true,
      extractInstructions: true,
      extractCookingTime: true,
      extractServings: true
    }
  };

  test('should parse recipe with context and return structured data', () => {
    const recipeText = `
      Chocolate Cake
      
      Ingredients:
      2 cups flour
      1 cup sugar
      3 eggs
      1/2 cup milk
      
      Instructions:
      1. Preheat oven to 350°F
      2. Mix dry ingredients in a bowl
      3. Beat eggs and add to mixture
      4. Bake for 30 minutes
      
      Serves: 8 people
      Cooking time: 30 minutes
    `;
    
    const recipe = parseRecipe(testContext, recipeText);
    
    expect(recipe).toBeDefined();
    expect(recipe.title).toBe('Chocolate Cake');
    expect(recipe.ingredients).toEqual([
      '2 cups flour',
      '1 cup sugar', 
      '3 eggs',
      '1/2 cup milk'
    ]);
    expect(recipe.instructions).toEqual([
      'Preheat oven to 350°F',
      'Mix dry ingredients in a bowl',
      'Beat eggs and add to mixture',
      'Bake for 30 minutes'
    ]);
    expect(recipe.servings).toBe(8);
    expect(recipe.cookingTime).toBe('30 minutes');
    expect(recipe.context).toEqual(testContext);
  });

  test('should handle different context configurations', () => {
    const minimalContext = {
      language: 'en',
      parseOptions: {
        extractIngredients: true,
        extractInstructions: false
      }
    };
    
    const recipeText = `
      Simple Pasta
      
      Ingredients:
      1 pound pasta
      2 tablespoons olive oil
      
      Instructions:
      1. Boil water
      2. Cook pasta
    `;
    
    const recipe = parseRecipe(minimalContext, recipeText);
    
    expect(recipe.title).toBe('Simple Pasta');
    expect(recipe.ingredients).toBeDefined();
    expect(recipe.instructions).toBeUndefined(); // Should not extract instructions based on context
  });

  test('should handle international recipes with language context', () => {
    const spanishContext = {
      language: 'es',
      cuisine: 'spanish',
      parseOptions: {
        extractIngredients: true,
        extractInstructions: true
      }
    };
    
    const recipeText = `
      Paella Valenciana
      
      Ingredientes:
      2 tazas de arroz
      1 libra de pollo
      
      Instrucciones:
      1. Calentar aceite en paellera
      2. Cocinar pollo hasta dorar
    `;
    
    const recipe = parseRecipe(spanishContext, recipeText);
    
    expect(recipe.title).toBe('Paella Valenciana');
    expect(recipe.language).toBe('es');
    expect(recipe.ingredients).toBeDefined();
  });

  test('should return null for invalid recipe text', () => {
    const recipe = parseRecipe(testContext, '');
    expect(recipe).toBeNull();
  });

  test('should return null for invalid context', () => {
    const recipe = parseRecipe(null, 'Some recipe text');
    expect(recipe).toBeNull();
  });

  test('should handle malformed recipe text gracefully', () => {
    const malformedText = `
      Just a title
      No ingredients or instructions
    `;
    
    const recipe = parseRecipe(testContext, malformedText);
    
    expect(recipe).toBeDefined();
    expect(recipe.title).toBe('Just a title');
    expect(recipe.ingredients).toEqual([]);
    expect(recipe.instructions).toEqual([]);
  });

  test('should preserve context information in parsed result', () => {
    const customContext = {
      language: 'fr',
      cuisine: 'french',
      difficulty: 'expert',
      source: 'cookbook',
      parseOptions: {
        extractIngredients: true,
        extractInstructions: true,
        extractNutrition: true
      }
    };
    
    const recipeText = 'Chocolate Cake\nIngredients:\n2 cups flour';
    const recipe = parseRecipe(customContext, recipeText);
    
    expect(recipe.context).toEqual(customContext);
    expect(recipe.parsedAt).toBeDefined();
    expect(recipe.version).toBeDefined();
  });
}); 