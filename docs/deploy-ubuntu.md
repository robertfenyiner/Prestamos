# Despliegue de Prestamos en Ubuntu Server

Guia para correr Prestamos en Ubuntu con Node.js, PM2 y Nginx.

## Arquitectura

```text
Internet o Cloudflare
  -> Nginx
  -> frontend/dist
  -> /api hacia backend en 127.0.0.1:3001
  -> SQLite en backend/data/prestamos.db
```

## 1. Dependencias

```bash
sudo apt update
sudo apt install -y git nginx curl build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. Clonar repo

```bash
sudo mkdir -p /opt
sudo chown -R $USER:$USER /opt
cd /opt
git clone https://github.com/robertfenyiner/Prestamos.git
cd Prestamos
```

## 3. Backend

```bash
cd /opt/Prestamos/backend
cp .env.example .env
nano .env
npm install
npm run build
mkdir -p data uploads
npm run seed
```

Antes de usar en produccion, edita `.env` y cambia `JWT_SECRET` por un valor largo y privado.

## 4. Frontend

```bash
cd /opt/Prestamos/frontend
npm install
npm run build
```

## 5. PM2

```bash
cd /opt/Prestamos
pm2 start ecosystem.config.js
pm2 save
pm2 status
pm2 startup systemd
```

Despues de `pm2 startup systemd`, PM2 mostrara un comando con sudo. Ejecutalo y luego corre `pm2 save`.

## 6. Nginx

```bash
sudo cp /opt/Prestamos/nginx/prestamos.conf /etc/nginx/sites-available/prestamos
sudo ln -s /etc/nginx/sites-available/prestamos /etc/nginx/sites-enabled/prestamos
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Cuando tengas dominio, cambia `server_name _;` en la configuracion por tu dominio real.

## 7. Verificacion

```bash
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1
pm2 logs prestamos-backend
```

## 8. Actualizar

```bash
cd /opt/Prestamos
git pull
cd backend
npm install
npm run build
cd ../frontend
npm install
npm run build
cd ..
pm2 restart prestamos-backend
```

## 9. Backup SQLite

```bash
mkdir -p /opt/backups/prestamos
cp /opt/Prestamos/backend/data/prestamos.db /opt/backups/prestamos/prestamos-$(date +%F-%H%M).db
```

## Seguridad

- Cambia la contrasena por defecto despues del primer inicio.
- Usa un `JWT_SECRET` privado y largo.
- No expongas directamente el puerto 3001.
- Usa Nginx como entrada publica.
