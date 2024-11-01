import { executeQuery } from "./rdb.js";

export const upsert = async ({
  accountId,
  planId,
  shared = 0,
  favourited = 0,
  created = 0,
}) => {
  const [result] = await executeQuery(
    `INSERT INTO account_plan (accountId, planId, shared, favourited, created) 
    VALUES (?, ?, ?, ?, ?) 
    ON DUPLICATE KEY UPDATE shared=?, favourited=?;`,
    [accountId, planId, shared, favourited, created, shared, favourited]
  );
  return result;
};

export const select = async ({ accountId, planId }) => {
  let result;
  if (accountId && planId) {
    [result] = await executeQuery(
      `SELECT * FROM account_plan WHERE accountId = ? AND planId = ?;`,
      [accountId, planId]
    );
  } else if (planId) {
    [result] = await executeQuery(
      "SELECT * FROM account_plan WHERE planId = ?;",
      [planId]
    );
  } else if (accountId) {
    [result] = await executeQuery(
      "SELECT * FROM account_plan WHERE accountId = ?;",
      [accountId]
    );
  }
  return result.map((row) => {
    row.shared = !!row.shared;
    row.favourited = !!row.favourited;
    row.created = !!row.created;
    return row;
  });
};

export const selectUsersSharedTo = async ({ planId }) => {
  const [result] = await executeQuery(
    `
    SELECT account.username
    FROM account
    INNER JOIN account_plan
      ON account_plan.accountId=account.id
    WHERE account_plan.planId=? AND account_plan.shared=1
    `,
    [planId]
  );

  return result.reduce((acc, { username }) => {
    acc.push(username);
    return acc;
  }, []);
};

export const del = async ({ accountId, planId }) => {
  let result;
  if (accountId && planId) {
    [result] = await executeQuery(
      `DELETE FROM account_plan WHERE accountId = ? AND planId = ?;`,
      [accountId, planId]
    );
  } else if (planId) {
    [result] = await executeQuery(
      "DELETE FROM account_plan WHERE planId = ?;",
      [planId]
    );
  } else if (accountId) {
    [result] = await executeQuery(
      "DELETE FROM account_plan WHERE accountId = ?;",
      [accountId]
    );
  }
  return result;
};

export default { upsert, select, selectUsersSharedTo, del };
