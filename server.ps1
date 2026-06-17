# ==========================================================================
# AuraBook 3D - PowerShell .NET HTTP Local Server
# ==========================================================================
# Run this script to host the AuraBook 3D client application locally on port 8080.
# Avoids CORS policies blocking ES6 modules and WebGL depth-map textures.

$port = 8080
$root = $PSScriptRoot
if ([string]::IsNullOrEmpty($root)) { $root = Get-Location }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  AuraBook 3D Local Server running at:" -ForegroundColor Cyan
Write-Host "  --> http://localhost:$port/" -ForegroundColor Green -Bold
Write-Host "  Press [Ctrl + C] in the terminal window to terminate." -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan

# MIME Types mappings
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Clean URL path and translate to local path
        $urlPath = $request.Url.LocalPath.Replace("/", "\")
        if ($urlPath -eq "\") {
            $urlPath = "\index.html"
        }

        $filePath = Join-Path $root $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = $mimeTypes[$ext]
            if ($null -eq $mime) {
                $mime = "application/octet-stream"
            }

            # Set headers
            $response.ContentType = $mime
            $response.StatusCode = 200
            
            # Disable caching for hot-reloading changes
            $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
            $response.Headers.Add("Pragma", "no-cache")
            $response.Headers.Add("Expires", "0")

            # Read and write bytes
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            # File not found
            $response.StatusCode = 404
            $response.ContentType = "text/plain; charset=utf-8"
            $msg = "404 - File Not Found: $urlPath"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }

        $response.Close()
    }
}
catch {
    Write-Host "Server halted: $_" -ForegroundColor Red
}
finally {
    $listener.Stop()
    $listener.Close()
    Write-Host "Server stopped." -ForegroundColor Yellow
}
