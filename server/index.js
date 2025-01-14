import "dotenv/config";
import express from "express";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { generate } from "./utils/generate-plan.js";
import { getProducts } from "./utils/get-products.js";
import "./utils/plan-rdb.js";
import {
  generateToken,
  authenticateToken,
  authenticateTokenMiddleware,
} from "./utils/authorize.js";
import plansCdb from "./utils/plans-db.js";
import planRdb from "./utils/plan-rdb.js";
import accountPlanRdb from "./utils/account-plan-rdb.js";
import accountRdb from "./utils/account-rdb.js";
import {
  selectAccountPlans,
  selectSharedPlans,
  searchPlans,
  selectMostViewedPlans,
  selectMostViewedPlansWithUser,
} from "./utils/queries.js";
import { loggerMiddleware, errorMiddleWare } from "./utils/logger.js";
import { getCurrentTimeSeconds } from "./utils/dates.js";

const PORT = process.env.PORT ?? 3000;
const IP = process.env.IP;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = express();
server.use(express.json());
server.use(loggerMiddleware);
const apiRouter = express.Router();

apiRouter.post("/authorise", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const account = await accountRdb.select({ username });

    if (account && password === account.password) {
      const token = generateToken(username, account.id);
      res.cookie("authToken", token, {
        maxAge: process.env.TOKEN_LIFETIME,
        httpOnly: true,
        sameSite: "strict",
      });
      res.sendStatus(200);
    } else {
      res.sendStatus(401);
    }
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/plan/new/:product/:recipe?", async (req, res, next) => {
  try {
    const { product, recipe } = req.params;
    const { amount, changedRecipes } = req.query;
    res.json(
      await generate(
        product,
        Number(amount),
        JSON.parse(changedRecipes),
        recipe
      )
    );
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/plan/:planId", async (req, res, next) => {
  try {
    const { planId } = req.params;

    const plan = await planRdb.select(planId);
    if (!plan) {
      return res.sendStatus(404);
    }

    const { name, description, isPublic, creator } = plan;

    let hasEditAccess = false;
    let isFavourite = false;

    const user = authenticateToken(req);
    if (user) {
      const [accountPlan] = await accountPlanRdb.select({
        accountId: user.id,
        planId,
      });

      if (accountPlan) {
        if (accountPlan.shared || accountPlan.created) {
          hasEditAccess = true;
        }
        if (accountPlan.favourited) {
          isFavourite = true;
        }
      }
      if (!isPublic && !hasEditAccess) {
        return res.sendStatus(403);
      }
    }

    if (!isPublic && !hasEditAccess) {
      return res.sendStatus(401);
    }

    const planJson = await plansCdb.get(planId);

    planRdb.update({ id: planId, values: { views: plan.views + 1 } });

    res.json({
      name,
      description,
      creator,
      isPublic,
      plan: planJson,
      hasEditAccess,
      isFavourite,
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/product-names", async (req, res, next) => {
  try {
    res.json(Object.keys(await getProducts()));
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/most-viewed-plans", async (req, res, next) => {
  try {
    const user = authenticateToken(req);

    let plans;
    if (user) {
      plans = await selectMostViewedPlansWithUser(user.id);
    } else {
      plans = await selectMostViewedPlans();
    }

    res.json(plans);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/search?", async (req, res, next) => {
  try {
    const { searchValue, orderingValue, orderDirection } = req.query;

    const user = authenticateToken(req);
    const plans = await searchPlans(
      searchValue,
      orderingValue,
      orderDirection,
      user?.name
    );

    res.json(plans);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/products", async (req, res, next) => {
  try {
    res.json(await getProducts());
  } catch (error) {
    next(error);
  }
});

apiRouter.use(authenticateTokenMiddleware);

apiRouter.delete("/deauthorise", async (req, res, next) => {
  try {
    res.clearCookie("authToken");
    res.end();
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/authenticate", async (req, res, next) => {
  try {
    res.json(req.user.name).status(200);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/plan/toggle-favourite/:planId", async (req, res, next) => {
  try {
    const { planId } = req.params;

    const plan = await planRdb.select(planId);
    if (!plan) {
      return res.sendStatus(404);
    }

    const accountPlan = await accountPlanRdb.select({
      acountId: req.user.id,
      planId,
    });
    if (accountPlan) {
      if (!plan.isPublic && !accountPlan.created && !accountPlan.shared) {
        return res.sendStatus(403);
      }

      if (
        !accountPlan.shared &&
        accountPlan.favourited &&
        !accountPlan.created
      ) {
        await accountPlanRdb.del({ accountId: req.user.id, planId });
        return res.sendStatus(200);
      }
    }

    await accountPlanRdb.upsert({
      accountId: req.user.id,
      planId,
      shared: accountPlan?.shared,
      favourited: !accountPlan?.favourited,
    });

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/plan/shared/:planId", async (req, res, next) => {
  try {
    const { planId } = req.params;

    const { creator } = await planRdb.select(planId);

    if (req.user.name !== creator) {
      return res.sendStatus(403);
    }

    const sharedTo = await accountPlanRdb.selectUsersSharedTo({ planId });
    res.json(sharedTo);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/plan/toggle-shared/:planId?", async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { username } = req.query;

    const plan = await planRdb.select(planId);
    if (!plan) {
      return res.sendStatus(404);
    }

    if (plan.creator !== req.user.name) {
      return res.sendStatus(403);
    }

    const account = await accountRdb.select({ username });
    if (!account) {
      return res.sendStatus(404);
    }

    const [accountPlan] = await accountPlanRdb.select({
      accountId: account.id,
      planId,
    });
    if (
      accountPlan &&
      accountPlan.shared &&
      !accountPlan.created &&
      !(plan.isPublic && accountPlan.favourited) // ignore favourited if not public plan
    ) {
      await accountPlanRdb.del({ accountId: account.id, planId });
      return res.sendStatus(200);
    }

    await accountPlanRdb.upsert({
      accountId: account.id,
      planId,
      shared: !accountPlan?.shared,
      favourited: accountPlan?.favourited,
    });

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/plan/toggle-isPublic/:planId", async (req, res, next) => {
  try {
    const { planId } = req.params;

    const plan = await planRdb.select(planId);

    if (!plan) {
      return res.sendStatus(404);
    }

    const [accountPlan] = await accountPlanRdb.select({
      accountId: req.user.id,
      planId,
    });

    if (accountPlan && accountPlan.created) {
      await planRdb.update({
        id: planId,
        values: { isPublic: !plan.isPublic },
      });
      return res.sendStatus(200);
    }
    res.sendStatus(403);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/plan", async (req, res, next) => {
  try {
    const { name, description, plan, isPublic } = req.body;

    const planId = uuidv4();

    const currentTimeSeconds = getCurrentTimeSeconds();

    await plansCdb.put(planId, plan);
    await planRdb.upsert({
      id: planId,
      creator: req.user.name,
      name,
      description,
      product: plan.item,
      amount: plan.amount,
      creationTime: currentTimeSeconds,
      isPublic,
    });
    await accountPlanRdb.upsert({
      accountId: req.user.id,
      planId,
      created: true,
    });

    res.json({ planId }).status(201);
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/plan/:planId", async (req, res, next) => {
  try {
    const { name, description, plan: newPlan, isPublic } = req.body;
    const { planId } = req.params;

    const plan = await planRdb.select(planId);
    if (!plan) {
      return res.sendStatus(404);
    }

    const [accountPlan] = await accountPlanRdb.select({
      accountId: req.user.id,
      planId,
    });

    if (!accountPlan?.created && !accountPlan.shared) {
      return res.sendStatus(403);
    }

    const oldPlan = await plansCdb.get(planId);
    if (oldPlan && JSON.stringify(oldPlan) !== JSON.stringify(newPlan)) {
      const rev = await plansCdb.getRevision(planId);
      await plansCdb.put(planId, newPlan, rev);
    }

    await planRdb.upsert({
      id: planId,
      creationTime: plan.creationTime,
      creator: plan.creator,
      name,
      description,
      product: newPlan.item,
      amount: newPlan.amount,
      isPublic,
    });

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/plan/:planId", async (req, res, next) => {
  try {
    const { planId } = req.params;

    const plan = await planRdb.select(planId);
    if (!plan) {
      return res.sendStatus(404);
    }

    const [accountPlan] = await accountPlanRdb.select({
      accountId: req.user.id,
      planId,
    });

    if (!accountPlan.created) {
      res.sendStatus(403);
    }

    await accountPlanRdb.del({ planId });
    await planRdb.del({ id: planId });
    await plansCdb.del(planId);

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/account/plan", async (req, res, next) => {
  try {
    const accountPlans = await selectAccountPlans(req.user.id);
    const sharedPlans = await selectSharedPlans(req.user.id);

    accountPlans.forEach((plan) => {
      if (plan.created) {
        plan.sharedTo = sharedPlans[plan.id] ?? [];
      }
      return plan;
    });

    res.json({
      public: accountPlans.filter((plan) => plan.created && plan.isPublic),
      private: accountPlans.filter((plan) => plan.created && !plan.isPublic),
      favourited: accountPlans.filter((plan) => plan.favourited),
      shared: accountPlans.filter((plan) => plan.shared),
    });
  } catch (error) {
    next(error);
  }
});

server.use("/api", apiRouter);
server.use(errorMiddleWare);

if (process.env.NODE_ENV === "production") {
  server.use(express.static(path.join(__dirname, "../client/dist")));
}

server.get("/*", async (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

server.listen(PORT, IP, () => {
  console.log("Listening to port", PORT);
});
