package soniox

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"time"
)

const baseURL = "https://api.soniox.com/v1"

type Client struct {
	APIKey string
	HTTP   *http.Client
}

func (c Client) TemporaryKey(ctx context.Context, meetingID string) (map[string]any, int, error) {
	result, status, err := c.jsonRequest(ctx, http.MethodPost, baseURL+"/auth/temporary-api-key", map[string]any{
		"usage_type": "transcribe_websocket", "expires_in_seconds": 60, "single_use": true,
		"max_session_duration_seconds": 14400, "client_reference_id": meetingID,
	})
	if err == nil && status/100 == 2 {
		status = http.StatusCreated
	}
	return result, status, err
}

func (c Client) StartTranscription(ctx context.Context, filename string, data []byte, hints []string) (map[string]any, int, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, filename))
	header.Set("Content-Type", "application/octet-stream")
	part, err := writer.CreatePart(header)
	if err != nil {
		return nil, 0, err
	}
	if _, err := part.Write(data); err != nil {
		return nil, 0, err
	}
	if err := writer.Close(); err != nil {
		return nil, 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/files", &body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	upload, status, err := c.doJSON(req)
	if err != nil || status/100 != 2 {
		return upload, status, err
	}
	fileID, _ := upload["id"].(string)
	payload := map[string]any{"model": "stt-async-v5", "file_id": fileID,
		"enable_speaker_diarization": true, "enable_language_identification": true}
	if len(hints) > 0 {
		payload["language_hints"] = hints
	}
	transcription, status, err := c.jsonRequest(ctx, http.MethodPost, baseURL+"/transcriptions", payload)
	if err != nil || status/100 != 2 {
		_, _, _ = c.jsonRequest(context.Background(), http.MethodDelete, baseURL+"/files/"+fileID, nil)
		return transcription, status, err
	}
	return map[string]any{"transcriptionId": transcription["id"], "fileId": fileID, "status": transcription["status"]}, 201, nil
}

func (c Client) Transcription(ctx context.Context, id string) (map[string]any, int, error) {
	status, code, err := c.jsonRequest(ctx, http.MethodGet, baseURL+"/transcriptions/"+id, nil)
	if err != nil || code/100 != 2 {
		return status, code, err
	}
	state, _ := status["status"].(string)
	if state == "error" {
		return nil, 502, errors.New(text(status["error_message"], "Transkripsiya xatolik bilan yakunlandi."))
	}
	if state != "completed" {
		return map[string]any{"status": state}, 200, nil
	}
	transcript, code, err := c.jsonRequest(ctx, http.MethodGet, baseURL+"/transcriptions/"+id+"/transcript", nil)
	if err != nil || code/100 != 2 {
		return transcript, code, err
	}
	result := map[string]any{"status": "completed", "text": transcript["text"], "tokens": transcript["tokens"], "audioDurationMs": status["audio_duration_ms"]}
	go c.cleanup(id, text(status["file_id"], ""))
	return result, 200, nil
}

func (c Client) cleanup(transcriptionID, fileID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_, _, _ = c.jsonRequest(ctx, http.MethodDelete, baseURL+"/transcriptions/"+transcriptionID, nil)
	if fileID != "" {
		_, _, _ = c.jsonRequest(ctx, http.MethodDelete, baseURL+"/files/"+fileID, nil)
	}
}

func (c Client) jsonRequest(ctx context.Context, method, url string, payload any) (map[string]any, int, error) {
	var body io.Reader
	if payload != nil {
		data, _ := json.Marshal(payload)
		body = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.doJSON(req)
}

func (c Client) doJSON(req *http.Request) (map[string]any, int, error) {
	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: 90 * time.Second}
	}
	response, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer response.Body.Close()
	data, err := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if err != nil {
		return nil, response.StatusCode, err
	}
	result := map[string]any{}
	if len(data) > 0 {
		if err := json.Unmarshal(data, &result); err != nil {
			return nil, response.StatusCode, err
		}
	}
	if response.StatusCode/100 != 2 {
		return result, response.StatusCode, errors.New(providerError(result))
	}
	return result, response.StatusCode, nil
}

func providerError(body map[string]any) string {
	for _, key := range []string{"message", "error_message", "detail", "error"} {
		if value, ok := body[key].(string); ok && value != "" {
			return value
		}
	}
	return "Soniox so‘rovi bajarilmadi"
}

func text(value any, fallback string) string {
	if result, ok := value.(string); ok && result != "" {
		return result
	}
	return fallback
}
