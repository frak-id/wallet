#include "bindings/bindings.h"

// Defined in FirebaseManager.swift — configures Firebase before Tauri starts
extern "C" void frak_init_firebase(void);

int main(int argc, char * argv[]) {
	frak_init_firebase();
	ffi::start_app();
	return 0;
}
