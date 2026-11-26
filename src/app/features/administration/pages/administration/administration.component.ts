import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../../../../core/http/api/api-config';
import { AuthStateService } from '../../../../core/auth/services/auth-state.service';
import { ToastService } from '../../../../core/notifications/toast.service';

type AdminTab = 'users'|'roles'|'audit'|'settings';
interface RolePermissionsResponse {
  roleUuid: string;
  roleName: string;
  description?: string | null;
  permissions: any[];
}
@Component({selector:'app-administration',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./administration.component.html',styleUrl:'./administration.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class AdministrationComponent {
 private http=inject(HttpClient); private route=inject(ActivatedRoute); private auth=inject(AuthStateService); private toast=inject(ToastService);
 readonly tab=signal<AdminTab>('users'); readonly loading=signal(false); readonly saving=signal(false);
 readonly users=signal<any[]>([]); readonly roles=signal<any[]>([]); readonly permissions=signal<any[]>([]); readonly rolePermissions=signal<any[]>([]);
 readonly auditLogs=signal<any[]>([]); readonly selectedRole=signal<any>(null); readonly selectedUser=signal<any>(null);
 readonly page=signal(0); readonly totalPages=signal(0); readonly search=signal(''); readonly auditAction=signal(''); readonly auditEntity=signal('');
 readonly showUserForm=signal(false); readonly showPasswordForm=signal(false); readonly showPermissions=signal(false);
 readonly userForm=signal({username:'',email:'',password:'',roleNames:['CASHIER'] as string[]});
 readonly editForm=signal({username:'',email:''}); readonly passwordForm=signal({newPassword:''});
 readonly roleOptions=['ADMIN','MANAGER','CASHIER'];
 readonly isAdmin=()=>this.auth.hasRole('ADMIN');
 readonly canUsers=()=>this.auth.hasPermission('USERS.VIEW');
 readonly canAudit=()=>this.auth.hasPermission('AUDIT_LOGS.VIEW');
 readonly canRoles=()=>this.auth.hasPermission('ROLES.VIEW');
 readonly modules=()=>[...new Set(this.permissions().map(p=>p.module).filter(Boolean))].sort();
 constructor(){const t=this.route.snapshot.data['adminTab'] as AdminTab|undefined;if(t)this.tab.set(t);this.loadForTab();}
 private loadForTab(){switch(this.tab()){case'users':this.loadUsers();this.loadRoles();break;case'roles':this.loadRoles();this.loadPermissions();break;case'audit':this.loadAudit();break;case'settings':break;}}
 setTab(t:AdminTab){this.tab.set(t);this.page.set(0);this.loadForTab();}
 loadUsers(){this.loading.set(true);const params=new HttpParams().set('page',String(this.page())).set('size','20').set('sortBy','id').set('sortDir','asc').set('search',this.search());this.http.get<any>(`${API_BASE_URL}/api/v1/admin/users/paged`,{params}).pipe(finalize(()=>this.loading.set(false))).subscribe({next:r=>{this.users.set(r.content??[]);this.totalPages.set(r.totalPages??0)},error:e=>this.toast.error(e?.error?.message||'Unable to load users.')});}
 loadRoles(){this.http.get<any[]>(`${API_BASE_URL}/api/v1/admin/roles`).subscribe({next:r=>this.roles.set(r??[]),error:e=>this.toast.error(e?.error?.message||'Unable to load roles.')});}
 loadPermissions(){this.http.get<any[]>(`${API_BASE_URL}/api/v1/admin/permissions`).subscribe({next:r=>this.permissions.set(r??[]),error:e=>this.toast.error(e?.error?.message||'Unable to load permissions.')});}
 loadAudit(){this.loading.set(true);let p=new HttpParams().set('page',String(this.page())).set('size','20').set('sortBy','createdAt').set('sortDir','desc');if(this.search())p=p.set('search',this.search());if(this.auditAction())p=p.set('action',this.auditAction());if(this.auditEntity())p=p.set('entityType',this.auditEntity());this.http.get<any>(`${API_BASE_URL}/api/v1/admin/audit-logs/paged`,{params:p}).pipe(finalize(()=>this.loading.set(false))).subscribe({next:r=>{this.auditLogs.set(r.content??[]);this.totalPages.set(r.totalPages??0)},error:e=>this.toast.error(e?.error?.message||'Unable to load audit logs.')});}
 setSearch(v:string){this.search.set(v);this.page.set(0);this.tab()==='audit'?this.loadAudit():this.loadUsers();}
 changePage(d:number){const n=this.page()+d;if(n>=0&&n<this.totalPages()){this.page.set(n);this.tab()==='audit'?this.loadAudit():this.loadUsers();}}
 openCreateUser(){this.userForm.set({username:'',email:'',password:'',roleNames:['CASHIER']});this.showUserForm.set(true);}
 toggleCreateRole(role:string,checked:boolean){this.userForm.update(f=>({...f,roleNames:checked?[...f.roleNames,role]:f.roleNames.filter(x=>x!==role)}));}
 createUser(){const f=this.userForm();if(!f.username.trim()||!f.email.trim()||f.password.length<12||!f.roleNames.length){this.toast.warning('Enter username, email, password (minimum 12 characters) and at least one role.');return;}this.saving.set(true);this.http.post(`${API_BASE_URL}/api/v1/admin/users`,f).pipe(finalize(()=>this.saving.set(false))).subscribe({next:()=>{this.toast.success('User created.');this.showUserForm.set(false);this.loadUsers();},error:e=>this.toast.error(e?.error?.message||'Unable to create user.')});}
 editUser(u:any){this.selectedUser.set(u);this.editForm.set({username:u.username,email:u.email??''});this.showUserForm.set(true);}
 saveUser(){const u=this.selectedUser(),f=this.editForm();if(!u)return;this.saving.set(true);this.http.put(`${API_BASE_URL}/api/v1/admin/users/${u.uuid}`,f).pipe(finalize(()=>this.saving.set(false))).subscribe({next:()=>{this.toast.success('User details updated.');this.showUserForm.set(false);this.selectedUser.set(null);this.loadUsers();},error:e=>this.toast.error(e?.error?.message||'Unable to update user.')});}
 updateStatus(u:any,enabled:boolean){if(!confirm(`${enabled?'Enable':'Disable'} ${u.username}?`))return;this.http.patch(`${API_BASE_URL}/api/v1/admin/users/${u.uuid}/status`,{enabled}).subscribe({next:()=>{this.toast.success('User status updated.');this.loadUsers();},error:e=>this.toast.error(e?.error?.message||'Unable to update user status.')});}
 assignRoles(u:any){this.selectedUser.set(u);this.userForm.set({username:u.username,email:u.email??'',password:'',roleNames:(u.roles??[]).map((x:string)=>x.replace('ROLE_',''))});this.showPermissions.set(true);}
 saveRoles(){const u=this.selectedUser(),roles=this.userForm().roleNames;if(!u||!roles.length)return;this.saving.set(true);this.http.put(`${API_BASE_URL}/api/v1/admin/users/${u.uuid}/roles`,{roleNames:roles}).pipe(finalize(()=>this.saving.set(false))).subscribe({next:()=>{this.toast.success('User roles updated.');this.showPermissions.set(false);this.loadUsers();},error:e=>this.toast.error(e?.error?.message||'Unable to update roles.')});}
 openPassword(u:any){this.selectedUser.set(u);this.passwordForm.set({newPassword:''});this.showPasswordForm.set(true);}
 resetPassword(){const u=this.selectedUser(),password=this.passwordForm().newPassword;if(!u||password.length<12){this.toast.warning('Password must contain at least 12 characters.');return;}this.saving.set(true);this.http.patch(`${API_BASE_URL}/api/v1/admin/users/${u.uuid}/password`,{newPassword:password}).pipe(finalize(()=>this.saving.set(false))).subscribe({next:()=>{this.toast.success('Password reset completed.');this.showPasswordForm.set(false);},error:e=>this.toast.error(e?.error?.message||'Unable to reset password.')});}
 selectRole(role:any){this.selectedRole.set(role);this.http.get<RolePermissionsResponse>(`${API_BASE_URL}/api/v1/admin/roles/${role.uuid}/permissions`).subscribe({next:r=>this.rolePermissions.set(r.permissions??[]),error:e=>this.toast.error(e?.error?.message||'Unable to load role permissions.')});}
 togglePermission(code:string,checked:boolean){this.rolePermissions.update(list=>checked?[...list.filter(p=>p.code!==code),this.permissions().find(p=>p.code===code)].filter(Boolean):list.filter(p=>p.code!==code));}
 saveRolePermissions(){const role=this.selectedRole();if(!role)return;const permissionCodes=this.rolePermissions().map(p=>p.code);if(!permissionCodes.length){this.toast.warning('At least one permission must remain assigned.');return;}this.saving.set(true);this.http.put<RolePermissionsResponse>(`${API_BASE_URL}/api/v1/admin/roles/${role.uuid}/permissions`,{permissionCodes}).pipe(finalize(()=>this.saving.set(false))).subscribe({next:r=>{this.toast.success('Role permissions updated.');this.rolePermissions.set(r.permissions??[]);},error:e=>this.toast.error(e?.error?.message||'Unable to save role permissions.')});}
 hasPermission(code:string){return this.rolePermissions().some(p=>p.code===code);}
 closeUser(){this.showUserForm.set(false);this.selectedUser.set(null);}
}
