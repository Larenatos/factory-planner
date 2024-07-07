import { executeQuery } from "./rdb.js";

export const selectAccountPlans = async (accountId) => {
  let [rdbResult] = await executeQuery(
    `
    SELECT plan.name, plan.description, plan.id, plan.product, plan.amount, plan.isPublic, plan.creator, account_plan.sharedTo, account_plan.favourited, account_plan.created
    FROM account_plan 
    INNER JOIN plan
    ON account_plan.planId=plan.id
    WHERE account_plan.accountId=?;`,
    [accountId]
  );

  rdbResult = rdbResult.map((row) => {
    row.sharedTo = !!row.sharedTo;
    row.favourited = !!row.favourited;
    row.created = !!row.created;
    return row;
  });

  return rdbResult;
};

export const selectSharedPlans = async (accountId) => {
  const [rdbResult] = await executeQuery(
    `
    SELECT B.planId, account.username
    FROM account_plan A, account_plan B
    INNER JOIN account
    ON B.accountId=account.id
    WHERE A.accountId=? AND A.created=1 AND B.planId=A.planId AND B.sharedTo=1 AND B.created=0
    ORDER BY B.planId;
    `,
    [accountId]
  );

  return rdbResult.reduce((acc, { planId, username }) => {
    if (!acc[planId]) {
      acc[planId] = [username];
    } else {
      acc[planId].push(username);
    }
    return acc;
  }, {});
};

export const selectPlanMetadata = async (accountId, planId) => {
  const [[rdbResult]] = await executeQuery(
    `
    SELECT account_plan.sharedTo, account_plan.created, account_plan.favourited, plan.isPublic
    FROM plan
    INNER JOIN account_plan
    ON plan.id=account_plan.planId
    WHERE account_plan.accountId=? AND account_plan.planId=?;`,
    [accountId, planId]
  );

  rdbResult.sharedTo = !!rdbResult.sharedTo;
  rdbResult.created = !!rdbResult.created;
  rdbResult.isPublic = !!rdbResult.isPublic;

  return rdbResult;
};
