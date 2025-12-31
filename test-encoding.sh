#!/bin/bash
# Test encoding/decoding roundtrip

test_roundtrip() {
    local input="$1"
    local expected="$2"

    # Encode: escape underscores first, then convert slashes
    encoded=$(echo "$input" | sed 's/_/__/g; s/\//_/g')
    # Decode: convert single underscores to slashes, then double to single
    decoded=$(echo "$encoded" | sed 's/__/\x00/g; s/_/\//g; s/\x00/_/g')

    if [ "$decoded" = "$expected" ]; then
        echo "PASS: $input -> $encoded -> $decoded"
    else
        echo "FAIL: $input -> $encoded -> $decoded (expected: $expected)"
        exit 1
    fi
}

test_security() {
    local input="$1"
    local should_block="$2"

    # Encode then decode
    encoded=$(echo "$input" | sed 's/_/__/g; s/\//_/g')
    decoded=$(echo "$encoded" | sed 's/__/\x00/g; s/_/\//g; s/\x00/_/g')

    if echo "$decoded" | grep -qE '(^/|\.\.)'; then
        blocked="yes"
    else
        blocked="no"
    fi

    if [ "$blocked" = "$should_block" ]; then
        echo "PASS: Security check for '$input' (blocked=$blocked)"
    else
        echo "FAIL: Security check for '$input' (blocked=$blocked, expected=$should_block)"
        exit 1
    fi
}

echo "=== Roundtrip Tests ==="
test_roundtrip "src/config/app.js" "src/config/app.js"
test_roundtrip "src/my_config.js" "src/my_config.js"
test_roundtrip "Dockerfile" "Dockerfile"
test_roundtrip "config/my_app_config.json" "config/my_app_config.json"
test_roundtrip "deep/path/with_underscore/file_name.js" "deep/path/with_underscore/file_name.js"

echo ""
echo "=== Security Tests ==="
test_security "../../../etc/passwd" "yes"
test_security "/etc/passwd" "yes"
test_security "src/normal/file.js" "no"
test_security "my_config.js" "no"

echo ""
echo "All tests passed!"
