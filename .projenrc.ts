const { awscdk } = require('projen');
const { JobPermission } = require('projen/lib/github/workflows-model');
const { UpgradeDependenciesSchedule } = require('projen/lib/javascript');

const AUTOMATION_TOKEN = 'PROJEN_GITHUB_TOKEN';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.97.0',
  defaultReleaseBranch: 'main',
  name: 'cdk-bedrock-knowledgebase',
  license: 'MIT-0',
  author: 'Court Schuett',
  copyrightOwner: 'Court Schuett',
  authorAddress: 'https://subaud.io',
  jest: false,
  projenrcTs: true,
  appEntrypoint: 'cdk-bedrock-knowledgebase.ts',
  depsUpgradeOptions: {
    ignoreProjen: false,
    workflowOptions: {
      labels: ['auto-approve', 'auto-merge'],
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
  },
  autoApproveOptions: {
    secret: 'GITHUB_TOKEN',
    allowedUsernames: ['schuettc'],
  },
  deps: [
    'dotenv',
    'aws-lambda',
    '@types/aws-lambda',
    '@aws-sdk/client-ssm',
    '@aws-sdk/client-bedrock-agent',
    '@aws-sdk/client-opensearchserverless',
    '@opensearch-project/opensearch',
  ],
  autoApproveUpgrades: true,
  projenUpgradeSecret: 'PROJEN_GITHUB_TOKEN',
});

project.tsconfigDev.file.addOverride('include', [
  'src/**/*.ts',
  './.projenrc.ts',
]);

project.eslint.addOverride({
  files: ['src/resources/**/*.ts'],
  rules: {
    'indent': 'off',
    '@typescript-eslint/indent': 'off',
  },
});

project.eslint.addOverride({
  files: ['src/resources/**/*.ts', 'src/*.ts'],
  rules: {
    '@typescript-eslint/no-require-imports': 'off',
    'import/no-extraneous-dependencies': 'off',
  },
});

const common_exclude = [
  '.yalc',
  'cdk.out',
  'cdk.context.json',
  'yarn-error.log',
  'dependabot.yml',
  '.DS_Store',
  '.env',
];

project.addTask('launch', {
  exec: 'yarn && yarn projen && yarn build && yarn cdk bootstrap && yarn cdk deploy --require-approval never',
});

project.gitignore.exclude(...common_exclude);
project.synth();
