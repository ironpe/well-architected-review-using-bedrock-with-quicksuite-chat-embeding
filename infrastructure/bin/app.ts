#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MinimalArchitectureReviewStack } from '../lib/minimal-stack';

const app = new cdk.App();

const stackName = 'ArchReview-Minimal';

new MinimalArchitectureReviewStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  stackName,
  description: 'Minimal Architecture Review System for testing',
});
