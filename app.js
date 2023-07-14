const express = require("express");

const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `
    SELECT 
        *
    FROM 
        user 
    WHERE 
        username = '${username}';
    `;

  const isUserPresent = await db.get(selectUserQuery);

  if (isUserPresent === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      isUserPresent.password
    );
    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRET_KEY");
      response.send({ jwtToken });
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authorizationHeader = request.headers["authorization"];

  if (authorizationHeader !== undefined) {
    jwtToken = authorizationHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
    SELECT 
        state_id,
        state_name,
        population 
    FROM 
        state
    ORDER BY 
        state_id;
    `;
  const allStates = await db.all(getAllStatesQuery);
  response.send(allStates);
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const getStatesQuery = `
    SELECT 
        * 
    FROM 
        state
    WHERE 
        state_id = ${stateId};
    `;
  const state = await db.get(getStatesQuery);
  response.send(state);
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const addDistrictQuery = `
    INSERT INTO 
        district (district_name, state_id, cases, cured, active, deaths)
    VALUES
        ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});
    `;

  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictQuery = `
    SELECT 
        * 
    FROM 
        district
    WHERE 
        district_id = ${districtId};
    `;
    const district = await db.get(getDistrictQuery);
    response.send(district);
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictQuery = `
    DELETE FROM 
        district
    WHERE 
        district_id = ${districtId};
    `;
    const district = await db.run(getDistrictQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;

    const updateDistrictQuery = `
    UPDATE 
        district 
    SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE 
        district_id = ${districtId};
    `;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getStateStatsQuery = `
    SELECT 
        SUM(cases) AS totalCases,
        SUM(active) AS totalActive,
        SUM(cured) AS totalCured,
        SUM(deaths) AS totalDeaths 
    FROM 
        state
    WHERE 
        state_id = ${stateId}
    GROUP BY 
        state_id;
    `;
    const stateStats = await db.all(getStateStatsQuery);
    response.send(stateStats);
  }
);

module.exports = app;
