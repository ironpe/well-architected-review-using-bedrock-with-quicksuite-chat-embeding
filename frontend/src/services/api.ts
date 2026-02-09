/**
 * API Client for Architecture Review System
 */

import axios, { AxiosInstance } from 'axios';
import { awsConfig } from '../config/aws-config';
import {
  CreateReviewRequestRequest,
  CreateReviewRequestResponse,
  GetReviewRequestResponse,
  UpdateReviewRequestStatusRequest,
  ExecuteReviewRequest,
  ExecuteReviewResponse,
  GetReviewStatusResponse,
  GetReviewResultsResponse,
  GetPillarsResponse,
  UpdatePillarRequest,
  ReviewRequest,
} from '../types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: awsConfig.api.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired, redirect to login
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Review Requests
  async createReviewRequest(data: CreateReviewRequestRequest): Promise<CreateReviewRequestResponse> {
    const response = await this.client.post('/review-requests', data);
    return response.data;
  }

  async getReviewRequest(reviewRequestId: string): Promise<GetReviewRequestResponse> {
    const response = await this.client.get(`/review-requests/${reviewRequestId}`);
    return response.data;
  }

  async listReviewRequests(): Promise<{ reviewRequests: ReviewRequest[]; count: number }> {
    const response = await this.client.get('/review-requests');
    return response.data;
  }

  async updateReviewRequestStatus(
    reviewRequestId: string,
    data: UpdateReviewRequestStatusRequest
  ): Promise<void> {
    await this.client.patch(`/review-requests/${reviewRequestId}/status`, data);
  }

  // Review Execution
  async executeReview(data: ExecuteReviewRequest): Promise<ExecuteReviewResponse> {
    const response = await this.client.post('/reviews/execute', data);
    return response.data;
  }

  async getReviewStatus(executionId: string): Promise<GetReviewStatusResponse> {
    const response = await this.client.get(`/reviews/${executionId}`);
    return response.data;
  }

  async getReviewResults(executionId: string): Promise<GetReviewResultsResponse> {
    const response = await this.client.get(`/reviews/${executionId}/results`);
    return response.data;
  }

  async getReviewExecutions(reviewRequestId: string): Promise<{ executions: any[] }> {
    const response = await this.client.get(`/reviews/request/${reviewRequestId}/executions`);
    return response.data;
  }

  // Download reports
  async downloadPdfReport(executionId: string): Promise<Blob> {
    const response = await this.client.post(`/reviews/${executionId}/download`, 
      { format: 'pdf' }
    );
    
    // Backend returns downloadUrl, fetch the file
    const fileResponse = await axios.get(response.data.downloadUrl, {
      responseType: 'blob',
    });
    
    return fileResponse.data;
  }

  async downloadWordReport(executionId: string): Promise<Blob> {
    const response = await this.client.post(`/reviews/${executionId}/download`, 
      { format: 'word' }
    );
    
    // Backend returns downloadUrl, fetch the file
    const fileResponse = await axios.get(response.data.downloadUrl, {
      responseType: 'blob',
    });
    
    return fileResponse.data;
  }

  // Pillar Configuration
  async getPillars(): Promise<GetPillarsResponse> {
    const response = await this.client.get('/agents/pillars');
    return response.data;
  }

  async updatePillar(pillarName: string, data: UpdatePillarRequest): Promise<void> {
    await this.client.put(`/agents/pillars/${pillarName}`, data);
  }

  async getPillarHistory(pillarName: string): Promise<any> {
    const response = await this.client.get(`/agents/pillars/${pillarName}/history`);
    return response.data;
  }

  // Nova Vision Configuration
  async getNovaVisionConfig(): Promise<{
    modelId: string;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
    enabled: boolean;
  }> {
    const response = await this.client.get('/agents/nova-vision');
    return response.data;
  }

  async updateNovaVisionConfig(
    modelId: string,
    maxTokens: number,
    temperature: number,
    systemPrompt: string,
    enabled: boolean
  ): Promise<void> {
    await this.client.put('/agents/nova-vision', {
      modelId,
      maxTokens,
      temperature,
      systemPrompt,
      enabled,
    });
  }

  // Document Upload - S3 Presigned URL 방식
  async uploadDocument(file: File, metadata: any, onProgress?: (progress: number) => void): Promise<any> {
    // Step 1: Get presigned URL
    const urlResponse = await this.client.post('/documents/get-upload-url', {
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      metadata,
    });

    const { uploadUrl, documentId, s3Key } = urlResponse.data;

    // Step 2: Upload directly to S3 with progress tracking
    // IMPORTANT: Use a clean axios instance without interceptors for S3 upload
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
        // Remove all other headers that might cause CORS issues
      },
      // Don't send credentials to S3
      withCredentials: false,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });

    // Step 3: Confirm upload
    const confirmResponse = await this.client.post('/documents/confirm-upload', {
      documentId,
      s3Key,
      metadata,
    });

    return confirmResponse.data;
  }

  // Governance Policies
  async uploadGovernancePolicy(file: File, title: string, description: string): Promise<any> {
    // Convert file to base64
    const fileBuffer = await file.arrayBuffer();
    const base64File = btoa(
      new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const response = await this.client.post('/governance/policies/upload', {
      file: base64File,
      fileName: file.name,
      title,
      description,
    });
    return response.data;
  }

  async getGovernancePolicies(): Promise<any> {
    const response = await this.client.get('/governance/policies');
    return response.data;
  }

  async deleteGovernancePolicy(policyId: string): Promise<void> {
    await this.client.delete(`/governance/policies/${policyId}`);
  }

  async toggleGovernancePolicyActive(policyId: string, isActive: boolean): Promise<void> {
    await this.client.patch(`/governance/policies/${policyId}/toggle`, { isActive });
  }

  // Review Requests
  async deleteReviewRequest(reviewRequestId: string): Promise<void> {
    await this.client.delete(`/review-requests/${reviewRequestId}`);
  }

  // Document Preview
  async getDocumentPreviewUrl(documentId: string): Promise<string> {
    const response = await this.client.get(`/documents/${documentId}/preview`);
    return response.data.previewUrl;
  }

  // Pillar Review Model Configuration
  async getPillarReviewModelConfig(): Promise<{ modelId: string }> {
    const response = await this.client.get('/agents/review-model');
    return response.data;
  }

  async updatePillarReviewModelConfig(modelId: string): Promise<void> {
    await this.client.put('/agents/review-model', { modelId });
  }
}

export const api = new ApiClient();
