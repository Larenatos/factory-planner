import recipesDB from "./recipes-db.js";

const ores = [
  "Bauxite",
  "Caterium Ore",
  "Coal",
  "Copper Ore",
  "Iron Ore",
  "Limestone",
  "Raw Quartz",
  "Sulfur",
  "Uranium",
  "Water",
  "Nitrogen Gas",
];

const getProducts = async () => {
  const recipesMap = await recipesDB.map();

  const products = recipesMap.rows.reduce((acc, partialProduct) => {
    const { key: productName, value: recipeName } = partialProduct;
    const product = acc[productName] ?? { base: "", alternate: [] };

    if (ores.includes(productName)) {
      product.base = productName;
      product.alternate.push(recipeName);
    } else {
      if (recipeName.includes("Alternate: ") || product.base) {
        product.alternate.push(recipeName);
      } else {
        product.base = recipeName;
      }
    }

    acc[productName] = product;
    return acc;
  }, {});

  return products;
};

const productsWithRecipes = await getProducts();

const generate = async ({ item, amount }, recipeToUse = null) => {
  console.log(item);
  let recipe;
  let alternateRecipes;

  if (productsWithRecipes[item]) {
    const { base, alternate } = productsWithRecipes[item];
    recipe = base;
    alternateRecipes = alternate;
  } else {
    recipe = item;
    alternateRecipes = [];
  }

  if (recipeToUse) {
    recipe = recipeToUse;
    const allRecipes = [recipe, ...alternateRecipes];
    alternateRecipes = allRecipes.reduce((acc, oneRecipe) => {
      if (!oneRecipe === recipeToUse) {
        acc.push(recipe);
      }
      return acc;
    });
  }

  const recipeData = await recipesDB.get(recipe);

  let buildings;
  let ingredients;
  let producedIn;
  if (!recipeData.error) {
    producedIn = recipeData.producedIn;

    const recipeProductionAmount = recipeData.products.reduce(
      (acc, product) => {
        return product.item === item ? product.amount : acc;
      },
      0
    );
    const recipeProductsPerMinute =
      (60 / recipeData.time) * recipeProductionAmount;
    buildings = amount / recipeProductsPerMinute;

    ingredients = [];
    for (const ingredient of recipeData.ingredients) {
      ingredients.push(
        await generate({
          item: ingredient.item,
          // amount: (amount * ingredient.amount) / recipeProductionAmount, // works
          amount: amount / (recipeProductionAmount / ingredient.amount), // works
          // amount: amount / recipeProductionAmount / ingredient.amount, // doesn't work
        })
      );
    }
  }

  return {
    item,
    amount,
    buildings,
    producedIn,
    recipe,
    alternateRecipes,
    ingredients,
  };
};

export default { generate, getProducts };