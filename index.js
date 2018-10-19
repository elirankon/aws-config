const AWS = require('aws-sdk');
const Promise = require('bluebird');

const utils = require('./utils');

const s3 = new AWS.S3();
const secretsManager = new AWS.SecretsManager();

const CONFIG_BUCKET = 'configs';

module.exports = {
    get: async ({ secretKeys = [], configKeys = [], setEnvironment = false }) => {
        let secrets = [];
        let configs = [];
        if (utils.currentEnv() === 'local') {
            return [...secretKeys, ...configKeys].map(key => ({
                name: key,
                value: process.env[key],
            }));
        }

        // eslint-disable-next-line max-len
        if (secretKeys.length > 0) {
            secrets = await Promise.map(secretKeys, async (secretKey) => {
                const obj = await secretsManager
                    .getSecretValue({ SecretId: `${process.env.NODE_ENV}_${secretKey}` })
                    .promise();
                return {
                    name: secretKey,
                    value: obj.SecretString,
                };
            });
        }

        if (configKeys.length > 0) {
            configs = await Promise.map(configKeys, async (configKey) => {
                const obj = await s3
                    .getObject({
                        Bucket: CONFIG_BUCKET,
                        Key: `${process.env.NODE_ENV}/${configKey}`,
                    })
                    .promise();

                return {
                    name: configKey,
                    value: obj.Body,
                };
            });
        }

        const allKeys = [...secrets, ...configs];

        if (setEnvironment && allKeys.length > 0) utils.setEnvVars(allKeys);

        return allKeys;
    },

    set: async ({ configPairs = [], secretPairs = [] }) => {
        if (utils.currentEnv() === 'local') return;

        let setConfigs = [];
        let setSecrets = [];
        if (configPairs.length > 0) {
            setConfigs = await Promise.map(
                configPairs,
                async configPair => configPair.name
                    && configPair.value
                    && s3
                        .putObject({
                            Bucket: CONFIG_BUCKET,
                            Key: `${process.env.NODE_ENV}/${configPair.name}`,
                            Body:
                                typeof configPair.value === 'string'
                                    ? configPair.value
                                    : JSON.stringify(configPair.value),
                            ACL: 'bucket-owner-full-control',
                        })
                        .promise(),
            );
        }

        if (secretPairs.length > 0) {
            setSecrets = await Promise.map(
                secretPairs,
                async secretPair => secretPair.name
                    && secretPair.value
                    && secretsManager
                        .updateSecret({
                            Name: secretPair.name,
                            SecretString:
                                typeof secretPair.value === 'string'
                                    ? secretPair.value
                                    : JSON.stringify(secretPair.value),
                        })
                        .promise(),
            );
        }

        return [...setConfigs, ...setSecrets];
    },
};
