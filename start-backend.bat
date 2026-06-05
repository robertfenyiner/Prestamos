@echo off
set PATH=C:\proyectos\node-22;%PATH%
cd /d C:\proyectos\Prestamos\backend
node node_modules\tsx\dist\cli.mjs watch src/index.ts
