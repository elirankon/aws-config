const setEnvVars = (envVars) => {
    envVars.forEach((envVar) => {
        process.env[envVar.name.toUpperCase()] = envVar.value;
    });
};

const currentEnv = () => process.env.NODE_ENV;

module.exports = {
    setEnvVars,
    currentEnv,
};
