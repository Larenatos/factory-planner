import styles from "./PlanSection.module.scss";
import { getItemRecipe } from "@/utils/api";
import { round } from "../../../../shared/round";

export const PlanSection = ({
  plan,
  updatePlan,
  layer,
  path = [],
  isNewPlan,
  hasEditAccess,
  changedRecipes,
}) => {
  const layerColor = `layer${layer}`;

  const onChange = async (e) => {
    const recipe = e.target.value;
    if (recipe !== plan.recipe) {
      const newPlan = await getItemRecipe(
        plan.item,
        recipe,
        plan.amount,
        changedRecipes
      );
      updatePlan(path, newPlan);
    }
  };

  return (
    <section className={`${styles.planSection} ${styles[layerColor]}`}>
      <div>{plan.item}</div>
      {plan.recipe && (
        <div>
          Recipe:
          {(isNewPlan || hasEditAccess) && plan.alternateRecipes.length ? (
            <select value={plan.recipe} onChange={onChange}>
              <option value={plan.recipe}>{plan.recipe}</option>
              {plan.alternateRecipes.map((alternateRecipe, index) => (
                <option value={alternateRecipe} key={index}>
                  {alternateRecipe}
                </option>
              ))}
            </select>
          ) : (
            " " + plan.recipe
          )}
        </div>
      )}
      {plan.buildingCount && (
        <div>
          Buildings: {round(plan.buildingCount, 4)} {plan.producedIn}
        </div>
      )}
      <div>Amount: {round(plan.amount, 4)}/min</div>
      <div className={styles.ingredients}>
        {plan.ingredients?.map((ingredient, index) => (
          <PlanSection
            plan={ingredient}
            updatePlan={updatePlan}
            layer={layer % 10 === 0 ? 1 : layer + 1}
            path={[...path, index]}
            key={`${plan.recipe}-${ingredient.item}-${index}`}
            isNewPlan={isNewPlan}
            hasEditAccess={hasEditAccess}
            changedRecipes={changedRecipes}
          />
        ))}
      </div>
    </section>
  );
};
