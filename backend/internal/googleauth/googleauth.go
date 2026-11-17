// Package googleauth verifies Firebase-issued Google ID tokens.
//
// Google only proves *who the person is*. The workspace, the access role and
// the session all stay with this API's own JWTs, so the sign-in method and
// authorisation remain separate concerns.
package googleauth

import (
	"context"
	"errors"
	"strings"

	firebase "firebase.google.com/go/v4"
	firebaseauth "firebase.google.com/go/v4/auth"
)

type Identity struct {
	Email    string
	Name     string
	Avatar   string
	Verified bool
}

type Verifier interface {
	Verify(ctx context.Context, idToken string) (Identity, error)
}

type firebaseVerifier struct {
	client *firebaseauth.Client
}

// New returns a verifier for the given Firebase project.
func New(ctx context.Context, projectID string) (Verifier, error) {
	app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: projectID})
	if err != nil {
		return nil, err
	}
	client, err := app.Auth(ctx)
	if err != nil {
		return nil, err
	}
	return firebaseVerifier{client: client}, nil
}

func (v firebaseVerifier) Verify(ctx context.Context, idToken string) (Identity, error) {
	token, err := v.client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return Identity{}, errors.New("Google tokeni tasdiqlanmadi.")
	}

	identity := Identity{}
	if email, ok := token.Claims["email"].(string); ok {
		identity.Email = strings.ToLower(strings.TrimSpace(email))
	}
	if name, ok := token.Claims["name"].(string); ok {
		identity.Name = strings.TrimSpace(name)
	}
	if picture, ok := token.Claims["picture"].(string); ok {
		identity.Avatar = picture
	}
	if verified, ok := token.Claims["email_verified"].(bool); ok {
		identity.Verified = verified
	}

	if identity.Email == "" {
		return Identity{}, errors.New("Google hisobida email yo‘q.")
	}
	// An unverified address could belong to somebody else, so never bind an
	// account to it.
	if !identity.Verified {
		return Identity{}, errors.New("Google hisobidagi email tasdiqlanmagan.")
	}
	if identity.Name == "" {
		identity.Name = strings.Split(identity.Email, "@")[0]
	}
	return identity, nil
}
